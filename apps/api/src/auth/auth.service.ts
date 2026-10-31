import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import {
  AcceptInvitationRequest,
  AuthenticatedUser,
  AuthenticationToken,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterTenantRequest,
  ResetPasswordRequest,
} from './auth.types';

const MODULE_VIEW_PERMISSIONS: Record<string, string> = {
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
  campaigns: 'campaigns.view',
};

const MODULE_WRITE_PERMISSIONS: Record<string, string> = {
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
  campaigns: 'campaigns.create',
};

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  signToken(userId: string, membershipId: string): string {
    return jwt.sign({ membershipId }, this.getSecret(), {
      subject: userId,
      expiresIn: this.getExpiresInSeconds(),
    });
  }

  verifyToken(token: string): AuthenticationToken {
    try {
      const payload = jwt.verify(token, this.getSecret());
      if (typeof payload === 'string' || !payload.sub || typeof payload.membershipId !== 'string') {
        throw new UnauthorizedException('Invalid or expired authentication token.');
      }
      return { userId: payload.sub, membershipId: payload.membershipId };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired authentication token.');
    }
  }

  /**
   * Synchronous token verification that returns the payload or null.
   * Used by AuthGuard before performing the async revocation check.
   */
  verifyTokenSilent(token: string): { sub: string; membershipId: string } | null {
    try {
      const payload = jwt.verify(token, this.getSecret()) as {
        sub: string;
        membershipId: string;
      };
      if (!payload.sub || typeof payload.membershipId !== 'string') {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async isTokenRevoked(token: string): Promise<boolean> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const revoked = await this.prisma.revokedToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
    return !!revoked;
  }

  async revokeToken(token: string): Promise<void> {
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const payload = jwt.verify(token, this.getSecret()) as {
      sub: string;
      membershipId: string;
      exp?: number;
    };
    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date();

    await this.prisma.revokedToken.create({
      data: {
        tokenHash,
        userId: payload.sub,
        expiresAt,
      },
    });
  }

  async login(credentials: LoginRequest): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const user = await this.prisma.user.findUnique({
      where: { email: credentials.email.trim().toLowerCase() },
      include: {
        memberships: {
          where: {
            status: 'ACTIVE',
            tenant: { slug: credentials.tenantSlug, status: 'ACTIVE' },
          },
          include: { tenant: true },
        },
      },
    });
    const membership = user?.memberships[0];

    if (
      !user ||
      user.status !== 'ACTIVE' ||
      !membership ||
      !(await this.comparePassword(credentials.password, user.passwordHash))
    ) {
      await this.prisma.auditLog.create({
        data: {
          tenantId: membership?.tenantId ?? null,
          actorMembershipId: membership?.id ?? null,
          actorUserId: user?.id ?? null,
          action: 'auth.login_failed',
          resource: 'authentication',
          resourceId: user?.id ?? null,
          metadata: { tenantSlug: credentials.tenantSlug },
        },
      });
      throw new UnauthorizedException('Invalid email, password, or tenant.');
    }

    const principal = await this.resolvePrincipal(user.id, membership.id);
    return { accessToken: this.signToken(user.id, membership.id), user: principal };
  }

  async registerTenant(
    request: RegisterTenantRequest,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const normalizedEmail = request.ownerEmail.trim().toLowerCase();
    const normalizedSlug = request.tenantSlug.trim().toLowerCase();

    const [existingUser, existingTenant, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      this.prisma.tenant.findUnique({ where: { slug: normalizedSlug }, select: { id: true } }),
      this.prisma.subscriptionPlan.findUnique({
        where: { code: request.planCode },
        include: {
          versions: {
            where: { isActive: true },
            orderBy: { version: 'desc' },
            take: 1,
            include: { entitlements: true },
          },
        },
      }),
    ]);

    if (existingUser) {
      throw new ConflictException('An account with this email address already exists.');
    }
    if (existingTenant) {
      throw new ConflictException('This tenant identifier is already taken.');
    }
    if (!plan || plan.versions.length === 0) {
      throw new NotFoundException('The requested subscription plan was not found.');
    }

    const planVersion = plan.versions[0];
    const passwordHash = await this.hashPassword(request.password);
    const now = new Date();
    const trialEndsAt =
      planVersion.trialDays > 0
        ? new Date(now.getTime() + planVersion.trialDays * 24 * 60 * 60 * 1000)
        : null;

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: normalizedEmail, name: request.ownerName.trim(), passwordHash },
      });

      const tenant = await tx.tenant.create({
        data: {
          slug: normalizedSlug,
          name: request.tenantName.trim(),
          businessType: request.businessType,
          status: 'ACTIVE',
        },
      });

      await tx.tenantSubscription.create({
        data: {
          tenantId: tenant.id,
          planVersionId: planVersion.id,
          status: trialEndsAt ? 'TRIALING' : 'PENDING_PAYMENT',
          startsAt: now,
          endsAt: null,
          trialEndsAt,
        },
      });

    const moduleKeys = [
      'pos', 'products', 'inventory', 'purchasing', 'pharmacy',
      'analytics', 'ai', 'stores', 'staff', 'campaigns',
    ];
    const planEntitlements = new Map(
      planVersion.entitlements.map(({ key, value }) => [key, value]),
    );
    
    // Only enable modules that the plan entitles
    const enabledModuleKeys = moduleKeys.filter((moduleKey) =>
      this.hasModuleEntitlement(planEntitlements.get(moduleKey)),
    );
    
    await tx.tenantModuleSetting.createMany({
      data: enabledModuleKeys.map((moduleKey) => ({
        tenantId: tenant.id,
        moduleKey,
        enabled: true,
      })),
    });

    const ownerRole = await tx.role.create({
      data: {
        tenantId: tenant.id,
        name: 'Tenant Owner',
        description: 'Full access to all tenant resources entitled by the subscription plan.',
        isSystem: true,
      },
    });

    await tx.role.createMany({
      data: [
        { tenantId: tenant.id, name: 'Tenant Administrator', description: 'Manage tenant configuration and staff.', isSystem: true },
        { tenantId: tenant.id, name: 'Store Manager', description: 'Manage store operations within assigned stores.', isSystem: true },
        { tenantId: tenant.id, name: 'Cashier', description: 'Process sales and view assigned store inventory.', isSystem: true },
        { tenantId: tenant.id, name: 'Inventory Manager', description: 'Manage inventory adjustments and stock counts.', isSystem: true },
      ],
    });

    // Assign only permissions corresponding to enabled modules
    const enabledPermissionCodes = new Set<string>();
    for (const moduleKey of enabledModuleKeys) {
      const viewPerm = MODULE_VIEW_PERMISSIONS[moduleKey] ?? `${moduleKey}.view`;
      const writePerm = MODULE_WRITE_PERMISSIONS[moduleKey] ?? `${moduleKey}.create`;
      enabledPermissionCodes.add(viewPerm);
      enabledPermissionCodes.add(writePerm);
    }
    
    const allowedPermissions = await tx.permission.findMany({
      where: { code: { in: Array.from(enabledPermissionCodes) } },
      select: { id: true },
    });
    await tx.rolePermission.createMany({
      data: allowedPermissions.map(({ id }) => ({ roleId: ownerRole.id, permissionId: id })),
      skipDuplicates: true,
    });

      const membership = await tx.membership.create({
        data: {
          tenantId: tenant.id,
          userId: user.id,
          status: 'ACTIVE',
          allStoreAccess: true,
        },
      });

      await tx.membershipRole.create({
        data: { tenantId: tenant.id, membershipId: membership.id, roleId: ownerRole.id },
      });

      await tx.auditLog.create({
        data: {
          tenantId: tenant.id,
          actorMembershipId: membership.id,
          actorUserId: user.id,
          action: 'tenant.registered',
          resource: 'tenant',
          resourceId: tenant.id,
          metadata: {
            tenantSlug: normalizedSlug,
            businessType: request.businessType,
            planCode: request.planCode,
          },
        },
      });

      return { user, tenant, membership };
    });

    const principal = await this.resolvePrincipal(result.user.id, result.membership.id);
    return { accessToken: this.signToken(result.user.id, result.membership.id), user: principal };
  }

  async acceptInvitation(
    request: AcceptInvitationRequest,
  ): Promise<{ accessToken: string; user: AuthenticatedUser }> {
    const invitation = await this.prisma.membershipInvitation.findUnique({
      where: { token: request.token.trim() },
      select: {
        id: true,
        tenantId: true,
        email: true,
        roleId: true,
        expiresAt: true,
        acceptedAt: true,
      },
    });

    if (!invitation || invitation.acceptedAt !== null || invitation.expiresAt <= new Date()) {
      throw new UnauthorizedException('This invitation is invalid or has expired.');
    }

    const normalizedEmail = invitation.email.toLowerCase();
    const existingUser = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true },
    });
    if (existingUser) {
      throw new ConflictException('An account with this email address already exists.');
    }

    const passwordHash = await this.hashPassword(request.password);

    const result = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { email: normalizedEmail, name: request.name.trim(), passwordHash },
      });

      const membership = await tx.membership.create({
        data: {
          tenantId: invitation.tenantId,
          userId: user.id,
          status: 'ACTIVE',
          allStoreAccess: false,
        },
      });

      await tx.membershipRole.create({
        data: {
          tenantId: invitation.tenantId,
          membershipId: membership.id,
          roleId: invitation.roleId,
        },
      });

      await tx.membershipInvitation.update({
        where: { id: invitation.id },
        data: { acceptedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          tenantId: invitation.tenantId,
          actorMembershipId: membership.id,
          actorUserId: user.id,
          action: 'staff.invitation_accepted',
          resource: 'membership',
          resourceId: membership.id,
          metadata: { invitationId: invitation.id },
        },
      });

      return { user, membership };
    });

    const principal = await this.resolvePrincipal(result.user.id, result.membership.id);
    return { accessToken: this.signToken(result.user.id, result.membership.id), user: principal };
  }

  // --- Password recovery ---

  async forgotPassword(request: ForgotPasswordRequest): Promise<{ token: string }> {
    const user = await this.prisma.user.findUnique({
      where: { email: request.email.trim().toLowerCase() },
    });
    if (!user || user.status !== 'ACTIVE') {
      // Do not reveal whether the email exists
      return { token: '' };
    }

    // Generate a short-lived reset token (15 minutes)
    const resetToken = jwt.sign(
      { sub: user.id, type: 'password_reset' },
      this.getSecret(),
      { expiresIn: '15m' },
    );

    // Store the reset token so it can be invalidated after use
    await this.prisma.revokedToken.create({
      data: {
        tokenHash: createHash('sha256').update(resetToken).digest('hex'),
        userId: user.id,
        expiresAt: new Date(Date.now() + 15 * 60 * 1000),
      },
    });

    return { token: resetToken };
  }

  async resetPassword(request: ResetPasswordRequest): Promise<void> {
    let payload: { sub: string; type: string };
    try {
      payload = jwt.verify(request.token, this.getSecret()) as {
        sub: string;
        type: string;
      };
    } catch {
      throw new UnauthorizedException('Invalid or expired reset token.');
    }

    if (payload.type !== 'password_reset') {
      throw new UnauthorizedException('Invalid reset token.');
    }

    // Check token has not been consumed/revoked
    const tokenHash = createHash('sha256').update(request.token).digest('hex');
    const revoked = await this.prisma.revokedToken.findFirst({
      where: {
        tokenHash,
        expiresAt: { gt: new Date() },
      },
    });
    if (!revoked) {
      throw new UnauthorizedException('Reset token has already been used or is invalid.');
    }

    const passwordHash = await this.hashPassword(request.password);

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: payload.sub },
        data: { passwordHash },
      });

      // Mark the reset token as consumed
      await tx.revokedToken.update({
        where: { id: revoked.id },
        data: { expiresAt: new Date() },
      });
    });
  }

  async resolvePrincipal(userId: string, membershipId: string): Promise<AuthenticatedUser> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        userId,
        status: 'ACTIVE',
        tenant: { status: 'ACTIVE' },
        user: { status: 'ACTIVE' },
      },
      include: {
        tenant: true,
        user: { select: { email: true } },
        roles: {
          include: {
            role: {
              include: { permissions: { include: { permission: true } } },
            },
          },
        },
        storeScopes: { select: { storeId: true } },
      },
    });

    if (!membership) {
      throw new UnauthorizedException('Active tenant membership is required.');
    }

    const roleNames = membership.roles.map(({ role }) => role.name);
    const permissions = [
      ...new Set(
        membership.roles.flatMap(({ role }) =>
          role.permissions.map(({ permission }) => permission.code),
        ),
      ),
    ];

    return {
      id: userId,
      membershipId: membership.id,
      tenantId: membership.tenantId,
      email: membership.user.email,
      role: roleNames[0] ?? '',
      roleNames,
      permissions,
      storeIds: membership.storeScopes.map(({ storeId }) => storeId),
      allStoreAccess: membership.allStoreAccess,
    };
  }

  private isModuleEnabled(value: unknown): boolean {
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

  private getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    return secret;
  }

  private getExpiresInSeconds(): number {
    const configured = process.env.JWT_EXPIRES_IN ?? '15m';
    const match = /^([1-9]\d*)(s|m|h|d)$/.exec(configured);
    if (!match) {
      throw new Error('JWT_EXPIRES_IN must use a positive duration such as 15m or 1h.');
    }
    const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
    return Number(match[1]) * multipliers[match[2]];
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
}
