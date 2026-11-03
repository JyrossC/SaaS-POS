import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import * as argon2 from 'argon2';
import { createOpaqueToken, hashOpaqueToken } from '../auth/auth-security';
import { EmailService } from '../email/email.service';
import { PrismaService } from '../database/prisma.service';
import {
  PlatformAdminInvitationAcceptanceRequest,
  PlatformAdminInvitationRequest,
  PlatformPlanCreateRequest,
  PlatformPlanVersionRequest,
  PlatformSupportAccessRequest,
} from './platform.types';

@Injectable()
export class PlatformManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async listAdmins() {
    return this.prisma.platformAdmin.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        mfaEnabled: true,
        createdAt: true,
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async inviteAdmin(input: PlatformAdminInvitationRequest, actorId: string) {
    const email = input.email.trim().toLowerCase();
    const existing = await this.prisma.platformAdmin.findUnique({
      where: { email },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A platform administrator already uses this email address.');
    }

    const token = createOpaqueToken();
    const invitation = await this.prisma.$transaction(async (tx) => {
      const created = await tx.platformAdminInvitation.create({
        data: {
          email,
          name: input.name.trim(),
          tokenHash: hashOpaqueToken(token),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          createdByPlatformAdminId: actorId,
        },
        select: { id: true },
      });
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: 'platform.admin.invitation_created',
          resource: 'platform_admin_invitation',
          resourceId: created.id,
          metadata: { email },
        },
      });
      return created;
    });

    try {
      await this.emailService.sendPlatformAdminInvitation(email, input.name.trim(), token);
    } catch (error) {
      await this.prisma.$transaction([
        this.prisma.platformAdminInvitation.updateMany({
          where: { id: invitation.id, acceptedAt: null, revokedAt: null },
          data: { revokedAt: new Date() },
        }),
        this.prisma.platformAuditLog.create({
          data: {
            actorPlatformAdminId: actorId,
            action: 'platform.admin.invitation_delivery_failed',
            resource: 'platform_admin_invitation',
            resourceId: invitation.id,
          },
        }),
      ]);
      throw error;
    }

    return { invited: true as const };
  }

  async acceptAdminInvitation(input: PlatformAdminInvitationAcceptanceRequest) {
    const tokenHash = hashOpaqueToken(input.token);
    const invitation = await this.prisma.platformAdminInvitation.findUnique({
      where: { tokenHash },
    });
    const now = new Date();
    if (
      !invitation ||
      invitation.acceptedAt ||
      invitation.revokedAt ||
      invitation.expiresAt <= now
    ) {
      throw new ConflictException('This platform administrator invitation is invalid or expired.');
    }

    const passwordHash = await argon2.hash(input.password, { type: argon2.argon2id });
    return this.prisma.$transaction(async (tx) => {
      const consumed = await tx.platformAdminInvitation.updateMany({
        where: {
          id: invitation.id,
          acceptedAt: null,
          revokedAt: null,
          expiresAt: { gt: now },
        },
        data: { acceptedAt: now },
      });
      if (consumed.count !== 1) {
        throw new ConflictException('This platform administrator invitation is invalid or expired.');
      }

      const admin = await tx.platformAdmin.create({
        data: {
          email: invitation.email,
          name: invitation.name,
          passwordHash,
          mfaEnabled: false,
        },
        select: { id: true, email: true, name: true },
      });
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: invitation.createdByPlatformAdminId,
          action: 'platform.admin.invitation_accepted',
          resource: 'platform_admin',
          resourceId: admin.id,
          metadata: { email: admin.email },
        },
      });
      return { accepted: true as const, email: admin.email };
    });
  }

  async updateAdminStatus(
    adminId: string,
    status: 'ACTIVE' | 'DISABLED',
    actorId: string,
  ) {
    if (adminId === actorId && status === 'DISABLED') {
      throw new ForbiddenException('You cannot disable your own platform administrator account.');
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<{ id: string }[]>`
        SELECT "id" FROM "PlatformAdmin"
        WHERE "status" = 'ACTIVE'
        ORDER BY "id"
        FOR UPDATE
      `;
      const admin = await tx.platformAdmin.findUnique({
        where: { id: adminId },
        select: { id: true, status: true, email: true },
      });
      if (!admin) {
        throw new NotFoundException('Platform administrator not found.');
      }
      if (admin.status === status) {
        return { id: admin.id, status: admin.status };
      }
      if (status === 'DISABLED') {
        const activeCount = await tx.platformAdmin.count({ where: { status: 'ACTIVE' } });
        if (activeCount <= 1) {
          throw new ConflictException('The last active platform administrator cannot be disabled.');
        }
      }

      await tx.platformAdmin.update({
        where: { id: admin.id },
        data: { status },
      });
      if (status === 'DISABLED') {
        await tx.authSession.updateMany({
          where: { platformAdminId: admin.id, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: status === 'DISABLED' ? 'platform.admin.disabled' : 'platform.admin.enabled',
          resource: 'platform_admin',
          resourceId: admin.id,
          metadata: { email: admin.email, previousStatus: admin.status, status },
        },
      });
      return { id: admin.id, status };
    });
  }

  listPlans() {
    return this.prisma.subscriptionPlan.findMany({
      orderBy: { code: 'asc' },
      include: {
        versions: {
          orderBy: { version: 'desc' },
          include: {
            entitlements: { orderBy: { key: 'asc' } },
            _count: { select: { subscriptions: true } },
          },
        },
      },
    });
  }

  async createPlan(input: PlatformPlanCreateRequest, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.create({
        data: {
          code: input.code.trim().toUpperCase(),
          name: input.name.trim(),
          versions: {
            create: {
              version: 1,
              trialDays: input.trialDays,
              billingPeriodDays: input.billingPeriodDays,
              currency: input.currency,
              price: input.price,
              entitlements: {
                create: this.toEntitlements(input.entitlements),
              },
            },
          },
        },
        include: { versions: { include: { entitlements: true } } },
      });
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: 'platform.plan.created',
          resource: 'subscription_plan',
          resourceId: plan.id,
          metadata: { code: plan.code, version: 1 },
        },
      });
      return plan;
    });
  }

  async createPlanVersion(planId: string, input: PlatformPlanVersionRequest, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.findUnique({
        where: { id: planId },
        select: { id: true, code: true, isAvailable: true },
      });
      if (!plan) {
        throw new NotFoundException('Subscription plan not found.');
      }
      const latest = await tx.subscriptionPlanVersion.findFirst({
        where: { planId },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const version = (latest?.version ?? 0) + 1;
      await tx.subscriptionPlanVersion.updateMany({
        where: { planId, isActive: true },
        data: { isActive: false },
      });
      const created = await tx.subscriptionPlanVersion.create({
        data: {
          planId,
          version,
          trialDays: input.trialDays,
          billingPeriodDays: input.billingPeriodDays,
          currency: input.currency,
          price: input.price,
          entitlements: { create: this.toEntitlements(input.entitlements) },
        },
        include: { entitlements: true },
      });
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: 'platform.plan.version_created',
          resource: 'subscription_plan',
          resourceId: plan.id,
          metadata: { code: plan.code, version, previousVersion: latest?.version ?? null },
        },
      });
      return created;
    });
  }

  async updatePlanAvailability(planId: string, isAvailable: boolean, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.subscriptionPlan.findUnique({ where: { id: planId } });
      if (!plan) {
        throw new NotFoundException('Subscription plan not found.');
      }
      if (plan.isAvailable === isAvailable) {
        return { id: plan.id, isAvailable: plan.isAvailable };
      }
      const updated = await tx.subscriptionPlan.update({
        where: { id: plan.id },
        data: { isAvailable },
      });
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: isAvailable ? 'platform.plan.enabled' : 'platform.plan.disabled',
          resource: 'subscription_plan',
          resourceId: plan.id,
          metadata: { code: plan.code, previousAvailability: plan.isAvailable, isAvailable },
        },
      });
      return { id: updated.id, isAvailable: updated.isAvailable };
    });
  }

  async assignTenantPlan(tenantId: string, planVersionId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found.');
      }
      const version = await tx.subscriptionPlanVersion.findFirst({
        where: { id: planVersionId, isActive: true, plan: { isAvailable: true } },
        include: { plan: { select: { code: true, name: true } } },
      });
      if (!version) {
        throw new NotFoundException('The selected plan version is not available for assignment.');
      }

      const now = new Date();
      const trialEndsAt = version.trialDays > 0
        ? new Date(now.getTime() + version.trialDays * 24 * 60 * 60 * 1000)
        : null;
      const endsAt = new Date(now.getTime() + version.billingPeriodDays * 24 * 60 * 60 * 1000);
      const isPaid = version.price !== null && !version.price.isZero();
      const subscriptionStatus = trialEndsAt
        ? 'TRIALING'
        : isPaid
          ? 'PENDING_PAYMENT'
          : 'ACTIVE';
      const previous = await tx.tenantSubscription.findUnique({
        where: { tenantId },
        select: { planVersionId: true, status: true },
      });
      const subscription = await tx.tenantSubscription.upsert({
        where: { tenantId },
        create: {
          tenantId,
          planVersionId,
          status: subscriptionStatus,
          startsAt: now,
          endsAt,
          trialEndsAt,
        },
        update: {
          planVersionId,
          status: subscriptionStatus,
          startsAt: now,
          endsAt,
          trialEndsAt,
        },
      });
      if (version.price && !version.price.isZero()) {
        await tx.subscriptionInvoice.create({
          data: {
            tenantId,
            subscriptionId: subscription.id,
            amount: version.price,
            currency: version.currency,
            status: 'PENDING_PAYMENT',
            dueAt: endsAt,
          },
        });
      }

      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: 'platform.tenant.plan_assigned',
          resource: 'tenant',
          resourceId: tenantId,
          metadata: {
            tenantName: tenant.name,
            previousPlanVersionId: previous?.planVersionId ?? null,
            previousSubscriptionStatus: previous?.status ?? null,
            planCode: version.plan.code,
            planVersion: version.version,
            subscriptionStatus: subscription.status,
            price: version.price?.toString() ?? null,
          },
        },
      });
      return {
        id: subscription.id,
        status: subscription.status,
        startsAt: subscription.startsAt,
        endsAt: subscription.endsAt,
        trialEndsAt: subscription.trialEndsAt,
        plan: { code: version.plan.code, name: version.plan.name, version: version.version },
      };
    });
  }

  async updateTenantStatus(
    tenantId: string,
    status: 'ACTIVE' | 'SUSPENDED',
    actorId: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, name: true, status: true },
      });
      if (!tenant) {
        throw new NotFoundException('Tenant not found.');
      }
      if (!['ACTIVE', 'SUSPENDED'].includes(tenant.status)) {
        throw new ConflictException('Only approved tenants can be suspended or reactivated.');
      }
      if (tenant.status === status) {
        return { id: tenant.id, status: tenant.status };
      }

      const updatedTenant = await tx.tenant.updateMany({
        where: { id: tenant.id, status: tenant.status },
        data: { status },
      });
      if (updatedTenant.count !== 1) {
        throw new ConflictException('Tenant status changed before this update could be applied.');
      }
      if (status === 'SUSPENDED') {
        const memberships = await tx.membership.findMany({
          where: { tenantId },
          select: { id: true },
        });
        await tx.authSession.updateMany({
          where: {
            membershipId: { in: memberships.map(({ id }) => id) },
            revokedAt: null,
          },
          data: { revokedAt: new Date() },
        });
      }
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: status === 'SUSPENDED'
            ? 'platform.tenant.suspended'
            : 'platform.tenant.reactivated',
          resource: 'tenant',
          resourceId: tenant.id,
          metadata: { name: tenant.name, previousStatus: tenant.status, status },
        },
      });
      return { id: tenant.id, status };
    });
  }

  async createSupportAccess(input: PlatformSupportAccessRequest, actorId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { id: true, name: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant not found.');
    }
    const expiresAt = new Date(Date.now() + input.durationMinutes * 60 * 1000);
    return this.prisma.$transaction(async (tx) => {
      const access = await tx.platformSupportAccess.create({
        data: {
          tenantId: tenant.id,
          createdByPlatformAdminId: actorId,
          purpose: input.purpose.trim(),
          scopes: input.scopes,
          expiresAt,
        },
      });
      await tx.platformSupportAccessEvent.create({
        data: {
          supportAccessId: access.id,
          actorPlatformAdminId: actorId,
          action: 'grant_created',
          metadata: { tenantId: tenant.id, scopes: input.scopes, expiresAt },
        },
      });
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: 'platform.support_access.granted',
          resource: 'platform_support_access',
          resourceId: access.id,
          metadata: { tenantId: tenant.id, purpose: access.purpose, scopes: input.scopes, expiresAt },
        },
      });
      return {
        id: access.id,
        tenantId: access.tenantId,
        tenantName: tenant.name,
        purpose: access.purpose,
        scopes: access.scopes,
        expiresAt: access.expiresAt,
        createdAt: access.createdAt,
        revokedAt: access.revokedAt,
      };
    });
  }

  async listSupportAccess(actorId: string) {
    const grants = await this.prisma.platformSupportAccess.findMany({
      where: { createdByPlatformAdminId: actorId },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
      orderBy: { createdAt: 'desc' },
      take: 100,
    });
    const events = grants.length
      ? await this.prisma.platformSupportAccessEvent.findMany({
          where: { supportAccessId: { in: grants.map(({ id }) => id) } },
          select: {
            id: true,
            supportAccessId: true,
            actorPlatformAdminId: true,
            action: true,
            scope: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];
    const eventsByGrant = new Map<string, typeof events>();
    for (const event of events) {
      const grantEvents = eventsByGrant.get(event.supportAccessId) ?? [];
      grantEvents.push(event);
      eventsByGrant.set(event.supportAccessId, grantEvents);
    }
    const now = new Date();
    return grants.map((grant) => ({
      id: grant.id,
      tenant: grant.tenant,
      purpose: grant.purpose,
      scopes: grant.scopes,
      expiresAt: grant.expiresAt,
      createdAt: grant.createdAt,
      revokedAt: grant.revokedAt,
      events: eventsByGrant.get(grant.id) ?? [],
      status: grant.revokedAt
        ? 'REVOKED'
        : grant.expiresAt <= now
          ? 'EXPIRED'
          : 'ACTIVE',
    }));
  }

  async revokeSupportAccess(accessId: string, actorId: string) {
    return this.prisma.$transaction(async (tx) => {
      const access = await tx.platformSupportAccess.findFirst({
        where: { id: accessId, createdByPlatformAdminId: actorId },
        select: { id: true, tenantId: true, revokedAt: true, expiresAt: true },
      });
      if (!access) {
        throw new NotFoundException('Support-access grant not found.');
      }
      if (access.revokedAt) {
        throw new ConflictException('This support-access grant has already been revoked.');
      }
      const revokedAt = new Date();
      await tx.platformSupportAccess.update({
        where: { id: access.id },
        data: { revokedAt },
      });
      await tx.platformSupportAccessEvent.create({
        data: {
          supportAccessId: access.id,
          actorPlatformAdminId: actorId,
          action: 'grant_revoked',
          metadata: { tenantId: access.tenantId },
        },
      });
      await tx.platformAuditLog.create({
        data: {
          actorPlatformAdminId: actorId,
          action: 'platform.support_access.revoked',
          resource: 'platform_support_access',
          resourceId: access.id,
          metadata: { tenantId: access.tenantId },
        },
      });
      return { id: access.id, revokedAt };
    });
  }

  async getSupportTenant(accessId: string, actorId: string) {
    return this.readSupportScope(accessId, actorId, 'tenant_profile', async (tx, tenantId) => {
      const tenant = await tx.tenant.findUnique({
        where: { id: tenantId },
        select: {
          id: true,
          name: true,
          slug: true,
          businessType: true,
          status: true,
          createdAt: true,
        },
      });
      if (!tenant) throw new NotFoundException('Tenant not found.');
      return tenant;
    });
  }

  async getSupportStores(accessId: string, actorId: string) {
    return this.readSupportScope(accessId, actorId, 'stores', async (tx, tenantId) =>
      tx.store.findMany({
        where: { tenantId },
        select: { id: true, name: true, code: true, status: true, location: true },
        orderBy: { name: 'asc' },
        take: 100,
      }),
    );
  }

  async getSupportProducts(accessId: string, actorId: string) {
    return this.readSupportScope(accessId, actorId, 'products', async (tx, tenantId) => {
      const [items, total] = await Promise.all([
        tx.product.findMany({
          where: { tenantId },
          select: {
            id: true,
            sku: true,
            name: true,
            baseUnit: true,
            sellingPrice: true,
            isActive: true,
          },
          orderBy: { name: 'asc' },
          take: 100,
        }),
        tx.product.count({ where: { tenantId } }),
      ]);
      return {
        items: items.map((item) => ({ ...item, sellingPrice: item.sellingPrice.toString() })),
        total,
        limit: 100,
      };
    });
  }

  async getSupportSalesSummary(accessId: string, actorId: string) {
    return this.readSupportScope(accessId, actorId, 'sales_summary', async (tx, tenantId) => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const [allTime, recent] = await Promise.all([
        tx.sale.aggregate({
          where: { tenantId, status: 'COMPLETED' },
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
        tx.sale.aggregate({
          where: { tenantId, status: 'COMPLETED', createdAt: { gte: since } },
          _count: { _all: true },
          _sum: { totalAmount: true },
        }),
      ]);
      return {
        allTime: {
          completedSales: allTime._count._all,
          grossTotal: allTime._sum.totalAmount?.toString() ?? '0.0000',
        },
        last30Days: {
          completedSales: recent._count._all,
          grossTotal: recent._sum.totalAmount?.toString() ?? '0.0000',
        },
        includesCustomerDetails: false as const,
      };
    });
  }

  private async readSupportScope<T>(
    accessId: string,
    actorId: string,
    scope: string,
    load: (tx: Prisma.TransactionClient, tenantId: string) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      const access = await tx.platformSupportAccess.findFirst({
        where: { id: accessId, createdByPlatformAdminId: actorId },
        select: { id: true, tenantId: true, scopes: true, expiresAt: true, revokedAt: true },
      });
      const now = new Date();
      if (!access || access.revokedAt || access.expiresAt <= now) {
        throw new ForbiddenException('An active support-access grant for this tenant is required.');
      }
      if (!access.scopes.includes(scope)) {
        throw new ForbiddenException(`This support-access grant does not include the ${scope} scope.`);
      }

      const result = await load(tx, access.tenantId);
      await tx.platformSupportAccessEvent.create({
        data: {
          supportAccessId: access.id,
          actorPlatformAdminId: actorId,
          action: 'scoped_data_read',
          scope,
          metadata: { tenantId: access.tenantId },
        },
      });
      return result;
    });
  }

  private toEntitlements(entitlements: Record<string, unknown>) {
    return Object.entries(entitlements).map(([key, value]) => ({
      key,
      value: value as Prisma.InputJsonValue,
    }));
  }
}
