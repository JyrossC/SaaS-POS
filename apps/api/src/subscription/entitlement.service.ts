import { ForbiddenException, Injectable } from '@nestjs/common';
import { SubscriptionStatus } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

export interface TenantEntitlementContext {
  tenantId: string;
  tenantActive: boolean;
  subscriptionStatus: SubscriptionStatus;
  subscriptionCurrent: boolean;
  planEntitlements: Map<string, unknown>;
  enabledModules: Set<string>;
  platformModules: Set<string>;
  limits: Map<string, number>;
  storeCount: number;
  staffCount: number;
}

@Injectable()
export class EntitlementService {
  constructor(private readonly prisma: PrismaService) {}

  async getContext(tenantId: string): Promise<TenantEntitlementContext> {
    const [tenant, platformModules, storeCount, staffCount] = await Promise.all([
      this.prisma.tenant.findUnique({
        where: { id: tenantId },
        include: {
          subscription: {
            include: {
              planVersion: {
                include: {
                  plan: true,
                  entitlements: true,
                },
              },
            },
          },
          moduleSettings: true,
        },
      }),
      this.prisma.platformModule.findMany({
        where: { enabled: true },
        select: { moduleKey: true },
      }),
      this.prisma.store.count({ where: { tenantId } }),
      this.prisma.membership.count({
        where: { tenantId, status: { in: ['ACTIVE', 'INVITED'] } },
      }),
    ]);

    const subscription = tenant?.subscription ?? null;
    const now = new Date();
    const status: SubscriptionStatus =
      subscription !== null ? subscription.status : SubscriptionStatus.EXPIRED;
    const planEntitlements = new Map(
      subscription !== null
        ? subscription.planVersion.entitlements.map(({ key, value }) => [key, value])
        : [],
    );

    return {
      tenantId,
      tenantActive: tenant?.status === 'ACTIVE',
      subscriptionStatus: status,
      subscriptionCurrent:
        subscription !== null &&
        subscription.startsAt <= now &&
        (subscription.endsAt === null || subscription.endsAt > now),
      planEntitlements,
      enabledModules: new Set(
        tenant?.moduleSettings.filter(({ enabled }) => enabled).map(({ moduleKey }) => moduleKey) ?? [],
      ),
      platformModules: new Set(platformModules.map(({ moduleKey }) => moduleKey)),
      limits: new Map(
        [...planEntitlements.entries()]
          .filter(([key, value]) => key.startsWith('limit.') && typeof value === 'number')
          .map(([key, value]) => [key.slice('limit.'.length), value as number]),
      ),
      storeCount,
      staffCount,
    };
  }

  canAccessModule(
    user: AuthenticatedUser,
    context: TenantEntitlementContext,
    moduleName: string,
    write: boolean = false,
  ): boolean {
    if (
      user.tenantId !== context.tenantId ||
      !context.tenantActive ||
      !context.subscriptionCurrent ||
      !context.platformModules.has(moduleName) ||
      !['ACTIVE', 'TRIALING'].includes(context.subscriptionStatus) ||
      !context.enabledModules.has(moduleName) ||
      !this.hasModuleEntitlement(context.planEntitlements.get(moduleName))
    ) {
      return false;
    }

    const permission = write
      ? this.moduleWritePermissionMap[moduleName]
      : this.modulePermissionMap[moduleName];

    return user.permissions.includes(permission ?? `${moduleName}.${write ? 'create' : 'view'}`);
  }

  canCreateStore(user: AuthenticatedUser, context: TenantEntitlementContext): boolean {
    const limit = context.limits.get('stores');
    return (
      limit !== undefined &&
      this.canAccessModule(user, context, 'stores') &&
      context.storeCount < limit
    );
  }

  canInviteStaff(user: AuthenticatedUser, context: TenantEntitlementContext): boolean {
    const limit = context.limits.get('staff');
    return (
      limit !== undefined &&
      this.canAccessModule(user, context, 'staff') &&
      context.staffCount < limit
    );
  }

  async assertCanCreateStore(user: AuthenticatedUser): Promise<void> {
    const context = await this.getContext(user.tenantId);
    if (!this.canAccessModule(user, context, 'stores')) {
      throw new ForbiddenException(
        'Store creation is not permitted under the current subscription limits or configuration.',
      );
    }
    const limit = context.limits.get('stores');
    if (limit === undefined) {
      throw new ForbiddenException('Store creation is not permitted under the current subscription limits or configuration.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock the tenant row to prevent concurrent store creation races
      await tx.$queryRawUnsafe(
        `SELECT id FROM "Tenant" WHERE id = $1 FOR UPDATE`,
        user.tenantId,
      );
      const tenant = await tx.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, status: true },
      });
      if (!tenant || tenant.status !== 'ACTIVE') {
        throw new ForbiddenException('Tenant is not active.');
      }

      const storeCount = await tx.store.count({
        where: { tenantId: user.tenantId },
      });
      if (storeCount >= limit) {
        throw new ForbiddenException('Store limit reached for the current subscription plan.');
      }
    });
  }

  async assertCanInviteStaff(user: AuthenticatedUser): Promise<void> {
    const context = await this.getContext(user.tenantId);
    if (!this.canAccessModule(user, context, 'staff')) {
      throw new ForbiddenException(
        'Staff invitation is not permitted under the current subscription limits or configuration.',
      );
    }
    const limit = context.limits.get('staff');
    if (limit === undefined) {
      throw new ForbiddenException('Staff invitation is not permitted under the current subscription limits or configuration.');
    }

    return this.prisma.$transaction(async (tx) => {
      // Lock the tenant row to prevent concurrent staff invitation races
      await tx.$queryRawUnsafe(
        `SELECT id FROM "Tenant" WHERE id = $1 FOR UPDATE`,
        user.tenantId,
      );
      const tenant = await tx.tenant.findUnique({
        where: { id: user.tenantId },
        select: { id: true, status: true },
      });
      if (!tenant || tenant.status !== 'ACTIVE') {
        throw new ForbiddenException('Tenant is not active.');
      }

      const staffCount = await tx.membership.count({
        where: { tenantId: user.tenantId, status: { in: ['ACTIVE', 'INVITED'] } },
      });
      if (staffCount >= limit) {
        throw new ForbiddenException('Staff limit reached for the current subscription plan.');
      }
    });
  }

  canUseFeature(
    user: AuthenticatedUser,
    context: TenantEntitlementContext,
    feature: string,
  ): boolean {
    return this.canAccessModule(user, context, feature);
  }

  getPlanLimits(context: TenantEntitlementContext): Record<string, number> {
    return Object.fromEntries(context.limits);
  }

  getUsage(context: TenantEntitlementContext) {
    return {
      stores: context.storeCount,
      staff: context.staffCount,
      limits: this.getPlanLimits(context),
    };
  }

  assertModuleAccess(
    user: AuthenticatedUser,
    context: TenantEntitlementContext,
    moduleName: string,
    write: boolean = false,
  ): void {
    if (!this.canAccessModule(user, context, moduleName, write)) {
      throw new ForbiddenException(
        `Module access denied for '${moduleName}' under the current subscription and tenant configuration.`,
      );
    }
  }

  private hasModuleEntitlement(value: unknown): boolean {
    if (typeof value === 'boolean') {
      return value;
    }
    return (
      typeof value === 'object' &&
      value !== null &&
      'enabled' in value &&
      value.enabled === true
    );
  }

  private readonly modulePermissionMap: Record<string, string> = {
    pos: 'sales.view',
    products: 'products.view',
    inventory: 'inventory.view',
    purchasing: 'purchases.view',
    pharmacy: 'pharmacy.batches.view',
    analytics: 'reports.view',
    ai: 'reports.view',
    stores: 'stores.create',
    staff: 'staff.invite',
    subscription: 'subscription.view',
  };

  private readonly moduleWritePermissionMap: Record<string, string> = {
    pos: 'sales.create',
    products: 'products.create',
    inventory: 'inventory.adjust',
    purchasing: 'purchases.create',
    pharmacy: 'pharmacy.batches.create',
    analytics: 'reports.view',
    ai: 'reports.view',
    stores: 'stores.create',
    staff: 'staff.invite',
    subscription: 'subscription.manage',
  };
}
