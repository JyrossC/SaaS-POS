import {
  ForbiddenException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { createHash } from 'node:crypto';
import { PrismaService } from '../database/prisma.service';
import {
  AcceptInvitationRequest,
  AuthenticatedUser,
  AuthenticationToken,
  ForgotPasswordRequest,
  LoginRequest,
  RegisterTenantRequest,
  TenantRegistrationResult,
  ResetPasswordRequest,
} from './auth.types';
import { EmailService } from '../email/email.service';
import {
  createOpaqueToken,
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaRecoveryCodes,
  getTotpProvisioningUri,
  createTotpSecret,
  hashOpaqueToken,
  verifyTotp,
} from './auth-security';

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
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailService: EmailService,
  ) {}

  async hashPassword(password: string): Promise<string> {
    return argon2.hash(password, { type: argon2.argon2id });
  }

  async comparePassword(password: string, hash: string): Promise<boolean> {
    return argon2.verify(hash, password);
  }

  signToken(userId: string, membershipId: string, sessionId: string): string {
    return jwt.sign({ membershipId, sessionId }, this.getSecret(), {
      subject: userId,
      expiresIn: 15 * 60,
    });
  }

  verifyToken(token: string): AuthenticationToken {
    try {
      const payload = jwt.verify(token, this.getSecret());
      if (
        typeof payload === 'string' ||
        !payload.sub ||
        typeof payload.membershipId !== 'string' ||
        typeof payload.sessionId !== 'string'
      ) {
        throw new UnauthorizedException('Invalid or expired authentication token.');
      }
      return { userId: payload.sub, membershipId: payload.membershipId, sessionId: payload.sessionId };
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Invalid or expired authentication token.');
    }
  }

  /**
   * Synchronous token verification that returns the payload or null.
   * Used by AuthGuard before performing the async revocation check.
   */
  verifyTokenSilent(token: string): { sub: string; membershipId: string; sessionId: string } | null {
    try {
      const payload = jwt.verify(token, this.getSecret()) as {
        sub: string;
        membershipId: string;
        sessionId: string;
      };
      if (
        !payload.sub ||
        typeof payload.membershipId !== 'string' ||
        typeof payload.sessionId !== 'string'
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  async isSessionActive(sessionId: string, userId: string): Promise<boolean> {
    const now = new Date();
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        userId,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      select: { id: true },
    });
    return Boolean(session);
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

  async login(credentials: LoginRequest): Promise<{
    accessToken: string;
    refreshToken: string;
    user: AuthenticatedUser;
  }> {
    const user = await this.prisma.user.findUnique({
      where: { email: credentials.email.trim().toLowerCase() },
      include: {
        memberships: {
          where: {
            status: 'ACTIVE',
            tenant: {
              slug: credentials.tenantSlug,
              status: { in: ['ACTIVE', 'PENDING_REVIEW', 'REJECTED'] },
            },
          },
          include: { tenant: true },
        },
      },
    });
    const membership = user?.memberships[0];
    const passwordMatches = Boolean(
      user &&
      user.status === 'ACTIVE' &&
      membership &&
      await this.comparePassword(credentials.password, user.passwordHash),
    );

    if (!user || !passwordMatches || !membership) {
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

    if (!user.emailVerifiedAt) {
      throw new ForbiddenException('Verify your email address before signing in. Request a new verification email if needed.');
    }

    if (user.mfaEnabled) {
      if (!credentials.mfaCode) {
        throw new UnauthorizedException('Multi-factor code required.');
      }
      if (!(await this.verifyUserMfa(user.id, user.mfaSecretEncrypted, credentials.mfaCode))) {
        throw new UnauthorizedException('Invalid email, password, or multi-factor code.');
      }
    }

    const principal = await this.resolvePrincipal(user.id, membership.id);
    const session = await this.createUserSession(user.id, membership.id);
    return {
      accessToken: this.signToken(user.id, membership.id, session.id),
      refreshToken: session.refreshToken,
      user: principal,
    };
  }

  async registerTenant(
    request: RegisterTenantRequest,
  ): Promise<TenantRegistrationResult> {
    const normalizedEmail = request.ownerEmail.trim().toLowerCase();
    const normalizedSlug = request.tenantSlug.trim().toLowerCase();

    const [existingUser, existingTenant, plan] = await Promise.all([
      this.prisma.user.findUnique({ where: { email: normalizedEmail }, select: { id: true } }),
      this.prisma.tenant.findUnique({ where: { slug: normalizedSlug }, select: { id: true } }),
      this.prisma.subscriptionPlan.findUnique({
        where: { code: request.planCode, isAvailable: true },
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

    await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: normalizedEmail,
          name: request.ownerName.trim(),
          passwordHash,
          emailVerifiedAt: null,
        },
      });

      const tenant = await tx.tenant.create({
        data: {
          slug: normalizedSlug,
          name: request.tenantName.trim(),
          businessType: request.businessType,
          status: 'PENDING_REVIEW',
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
    if (enabledModuleKeys.includes('staff')) {
      enabledPermissionCodes.add('staff.view');
      enabledPermissionCodes.add('staff.deactivate');
      enabledPermissionCodes.add('roles.view');
      enabledPermissionCodes.add('roles.create');
      enabledPermissionCodes.add('roles.update');
      enabledPermissionCodes.add('roles.assign_permissions');
    }
    enabledPermissionCodes.add('business_settings.view');
    enabledPermissionCodes.add('business_settings.update');
    enabledPermissionCodes.add('fiscal_settings.view');
    enabledPermissionCodes.add('fiscal_settings.update');
    
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

    });

    await this.sendVerificationEmail(normalizedEmail);

    return {
      status: 'PENDING_REVIEW',
      message: 'Registration submitted. Verify your email address to access the onboarding portal.',
    };
  }

  async acceptInvitation(
    request: AcceptInvitationRequest,
  ): Promise<{ status: 'EMAIL_VERIFICATION_REQUIRED'; message: string }> {
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

    await this.prisma.$transaction(async (tx) => {
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

    await this.sendVerificationEmail(normalizedEmail);
    return {
      status: 'EMAIL_VERIFICATION_REQUIRED',
      message: 'Invitation accepted. Verify your email address before signing in.',
    };
  }

  async resendEmailVerification(email: string): Promise<{ message: string }> {
    await this.sendVerificationEmail(email.trim().toLowerCase());
    return {
      message: 'If this account requires email verification, instructions will be sent.',
    };
  }

  async verifyEmail(token: string): Promise<{ verified: true }> {
    const tokenHash = hashOpaqueToken(token);
    const verification = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, expiresAt: true, consumedAt: true },
    });
    const now = new Date();
    if (!verification || verification.consumedAt || verification.expiresAt <= now) {
      throw new UnauthorizedException('This email verification link is invalid or has expired.');
    }

    await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.emailVerificationToken.updateMany({
        where: { id: verification.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException('This email verification link is invalid or has expired.');
      }
      await tx.user.update({
        where: { id: verification.userId },
        data: { emailVerifiedAt: now },
      });
    });
    return { verified: true };
  }

  async createUserSession(userId: string, membershipId: string) {
    const now = new Date();
    const refreshToken = createOpaqueToken();
    const refreshTokenHash = hashOpaqueToken(refreshToken);
    const absoluteExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const idleExpiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        userId,
        membershipId,
        refreshTokenHash,
        lastUsedAt: now,
        idleExpiresAt,
        absoluteExpiresAt,
        refreshTokens: {
          create: {
            userId,
            tokenHash: refreshTokenHash,
            expiresAt: absoluteExpiresAt,
          },
        },
      },
      select: { id: true },
    });
    return { id: session.id, refreshToken };
  }

  async refreshUserSession(refreshToken: string) {
    const tokenHash = hashOpaqueToken(refreshToken);
    const storedToken = await this.prisma.authRefreshToken.findUnique({
      where: { tokenHash },
      include: {
        session: true,
        user: { select: { id: true, status: true, emailVerifiedAt: true } },
      },
    });
    const now = new Date();
    if (!storedToken) {
      throw new UnauthorizedException('Refresh session is invalid or expired.');
    }
    if (storedToken.consumedAt) {
      await this.prisma.authSession.updateMany({
        where: { id: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Refresh token reuse detected. Sign in again.');
    }
    if (
      !storedToken.user ||
      storedToken.user.status !== 'ACTIVE' ||
      !storedToken.user.emailVerifiedAt ||
      storedToken.session.revokedAt ||
      storedToken.session.idleExpiresAt <= now ||
      storedToken.session.absoluteExpiresAt <= now ||
      storedToken.expiresAt <= now
    ) {
      await this.prisma.authSession.updateMany({
        where: { id: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Refresh session is invalid or expired.');
    }

    const membershipId = storedToken.session.membershipId;
    const userId = storedToken.user.id;
    if (!membershipId) {
      throw new UnauthorizedException('Refresh session is invalid or expired.');
    }
    const nextRefreshToken = createOpaqueToken();
    const nextHash = hashOpaqueToken(nextRefreshToken);
    const nextIdleExpiry = new Date(Math.min(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
      storedToken.session.absoluteExpiresAt.getTime(),
    ));
    const rotated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authRefreshToken.updateMany({
        where: { id: storedToken.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;
      const updatedSession = await tx.authSession.updateMany({
        where: {
          id: storedToken.sessionId,
          refreshTokenHash: tokenHash,
          revokedAt: null,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
        },
        data: {
          refreshTokenHash: nextHash,
          lastUsedAt: now,
          idleExpiresAt: nextIdleExpiry,
        },
      });
      if (updatedSession.count !== 1) {
        throw new UnauthorizedException('Refresh session is invalid or expired.');
      }
      await tx.authRefreshToken.create({
        data: {
          sessionId: storedToken.sessionId,
          userId,
          tokenHash: nextHash,
          expiresAt: storedToken.session.absoluteExpiresAt,
        },
      });
      return true;
    });
    if (!rotated) {
      await this.prisma.authSession.updateMany({
        where: { id: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Refresh token reuse detected. Sign in again.');
    }

    const user = await this.resolvePrincipal(userId, membershipId);
    return {
      accessToken: this.signToken(user.id, membershipId, storedToken.sessionId),
      refreshToken: nextRefreshToken,
      user,
    };
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllUserSessions(userId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async setupUserMfa(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, status: 'ACTIVE' },
      select: { id: true, email: true, mfaEnabled: true },
    });
    if (!user) {
      throw new UnauthorizedException('Active account access is required.');
    }
    if (user.mfaEnabled) {
      throw new ConflictException('Disable existing MFA with a valid code before setting it up again.');
    }
    const secret = createTotpSecret();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { mfaPendingSecretEncrypted: encryptMfaSecret(secret) },
    });
    return {
      secret,
      provisioningUri: getTotpProvisioningUri(secret, user.email),
    };
  }

  async confirmUserMfa(userId: string, code: string): Promise<{ recoveryCodes: string[] }> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaPendingSecretEncrypted: true },
    });
    if (user?.mfaEnabled || !user?.mfaPendingSecretEncrypted) {
      throw new ConflictException('Start MFA setup before confirming it.');
    }
    const secret = decryptMfaSecret(user.mfaPendingSecretEncrypted);
    if (!verifyTotp(secret, code)) {
      throw new UnauthorizedException('The authenticator code is invalid.');
    }
    const recoveryCodes = generateMfaRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      const enabled = await tx.user.updateMany({
        where: {
          id: userId,
          mfaEnabled: false,
          mfaPendingSecretEncrypted: user.mfaPendingSecretEncrypted,
        },
        data: {
          mfaEnabled: true,
          mfaSecretEncrypted: user.mfaPendingSecretEncrypted,
          mfaPendingSecretEncrypted: null,
        },
      });
      if (enabled.count !== 1) {
        throw new ConflictException('MFA setup was already completed or replaced.');
      }
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({ userId, tokenHash: hashOpaqueToken(code) })),
      });
    });
    return { recoveryCodes };
  }

  async disableUserMfa(userId: string, code: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { mfaEnabled: true, mfaSecretEncrypted: true },
    });
    if (
      !user?.mfaEnabled ||
      !(await this.verifyUserMfa(userId, user.mfaSecretEncrypted, code))
    ) {
      throw new UnauthorizedException('The authenticator or recovery code is invalid.');
    }
    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: {
          mfaEnabled: false,
          mfaSecretEncrypted: null,
          mfaPendingSecretEncrypted: null,
        },
      });
      await tx.mfaRecoveryCode.deleteMany({ where: { userId } });
    });
  }

  private async verifyUserMfa(
    userId: string,
    encryptedSecret: string | null,
    code: string,
  ): Promise<boolean> {
    if (!encryptedSecret) return false;
    if (verifyTotp(decryptMfaSecret(encryptedSecret), code)) return true;
    const tokenHash = hashOpaqueToken(code.trim().toUpperCase());
    const recoveryCode = await this.prisma.mfaRecoveryCode.findFirst({
      where: { userId, tokenHash, usedAt: null },
      select: { id: true },
    });
    if (!recoveryCode) return false;
    const consumed = await this.prisma.mfaRecoveryCode.updateMany({
      where: { id: recoveryCode.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return consumed.count === 1;
  }

  private async sendVerificationEmail(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: { id: true, emailVerifiedAt: true, status: true },
    });
    if (!user || user.status !== 'ACTIVE' || user.emailVerifiedAt) {
      await this.emailService.sendEmailVerification(email);
      return;
    }

    const token = createOpaqueToken();
    await this.prisma.emailVerificationToken.create({
      data: {
        userId: user.id,
        tokenHash: hashOpaqueToken(token),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    await this.emailService.sendEmailVerification(email, token);
  }

  // --- Password recovery ---

  async forgotPassword(request: ForgotPasswordRequest): Promise<{ message: string }> {
    const email = request.email.trim().toLowerCase();
    const user = await this.prisma.user.findUnique({
      where: { email },
    });
    let resetToken: string | undefined;
    if (user?.status === 'ACTIVE') {
      resetToken = jwt.sign(
        { sub: user.id, type: 'password_reset' },
        this.getSecret(),
        { expiresIn: '15m' },
      );

      await this.prisma.revokedToken.create({
        data: {
          tokenHash: createHash('sha256').update(resetToken).digest('hex'),
          userId: user.id,
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        },
      });
    }

    await this.emailService.sendPasswordReset(email, resetToken);
    return {
      message: 'If an account exists for this address, password reset instructions will be sent.',
    };
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
      const consumed = await tx.revokedToken.updateMany({
        where: {
          id: revoked.id,
          expiresAt: { gt: new Date() },
        },
        data: { expiresAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException('Reset token has already been used or is invalid.');
      }

      await tx.user.update({
        where: { id: payload.sub },
        data: { passwordHash },
      });
      await tx.authSession.updateMany({
        where: { userId: payload.sub, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  async resolvePrincipal(userId: string, membershipId: string): Promise<AuthenticatedUser> {
    const membership = await this.prisma.membership.findFirst({
      where: {
        id: membershipId,
        userId,
        status: 'ACTIVE',
        tenant: { status: { in: ['ACTIVE', 'PENDING_REVIEW', 'REJECTED'] } },
        user: { status: 'ACTIVE', emailVerifiedAt: { not: null } },
      },
      include: {
        tenant: true,
        user: { select: { email: true, mfaEnabled: true } },
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

    const tenantStatus = membership.tenant.status;
    if (
      tenantStatus !== 'ACTIVE' &&
      tenantStatus !== 'PENDING_REVIEW' &&
      tenantStatus !== 'REJECTED'
    ) {
      throw new UnauthorizedException('This tenant cannot authenticate.');
    }

    const roleNames = membership.roles.map(({ role }) => role.name);
    if (
      tenantStatus !== 'ACTIVE' &&
      !roleNames.includes('Tenant Owner')
    ) {
      throw new UnauthorizedException('Only the tenant owner can access its onboarding application.');
    }
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
      tenantStatus,
      email: membership.user.email,
      mfaEnabled: membership.user.mfaEnabled,
      role: roleNames[0] ?? '',
      roleNames,
      permissions: tenantStatus === 'ACTIVE' ? permissions : [],
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
