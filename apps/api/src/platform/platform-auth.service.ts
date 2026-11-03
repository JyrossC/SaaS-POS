import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { PlatformAdminPrincipal, PlatformLoginRequest } from './platform.types';
import {
  createOpaqueToken,
  decryptMfaSecret,
  encryptMfaSecret,
  generateMfaRecoveryCodes,
  getTotpProvisioningUri,
  createTotpSecret,
  hashOpaqueToken,
  verifyTotp,
} from '../auth/auth-security';

@Injectable()
export class PlatformAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(credentials: PlatformLoginRequest): Promise<{
    mfaSetupRequired: true;
    setupToken: string;
    platformAdmin: PlatformAdminPrincipal;
  } | {
    accessToken: string;
    refreshToken: string;
    recoveryCodes?: string[];
    platformAdmin: PlatformAdminPrincipal;
  }> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: credentials.email.trim().toLowerCase() },
    });

    if (!admin || admin.status !== 'ACTIVE' || !(await argon2.verify(admin.passwordHash, credentials.password))) {
      await this.prisma.platformAuditLog.create({
        data: {
          action: 'platform.auth.login_failed',
          resource: 'platform-authentication',
          metadata: { email: credentials.email.trim().toLowerCase() },
        },
      });
      throw new UnauthorizedException('Invalid platform administrator credentials.');
    }

    if (!admin.mfaEnabled) {
      return {
        mfaSetupRequired: true,
        setupToken: this.createMfaSetupToken(admin.id),
        platformAdmin: { id: admin.id, email: admin.email, name: admin.name },
      };
    }

    if (
      !credentials.mfaCode ||
      !(await this.verifyMfaCode(admin.id, admin.mfaSecretEncrypted, credentials.mfaCode))
    ) {
      throw new UnauthorizedException(
        credentials.mfaCode
          ? 'Invalid platform administrator credentials or multi-factor code.'
          : 'Multi-factor code required.',
      );
    }

    await this.prisma.platformAuditLog.create({
      data: {
        actorPlatformAdminId: admin.id,
        action: 'platform.auth.login_succeeded',
        resource: 'platform-authentication',
        resourceId: admin.id,
      },
    });

    return this.createAdminSession(admin.id, { id: admin.id, email: admin.email, name: admin.name });
  }

  async setupMfa(setupToken: string): Promise<{ secret: string; provisioningUri: string }> {
    const adminId = this.verifyMfaSetupToken(setupToken);
    const admin = await this.prisma.platformAdmin.findFirst({
      where: { id: adminId, status: 'ACTIVE' },
      select: { id: true, mfaEnabled: true },
    });
    if (!admin) {
      throw new UnauthorizedException('Active platform administrator access is required.');
    }
    if (admin.mfaEnabled) {
      throw new ConflictException('Platform MFA is already enabled.');
    }
    const secret = createTotpSecret();
    await this.prisma.platformAdmin.update({
      where: { id: admin.id },
      data: { mfaPendingSecretEncrypted: encryptMfaSecret(secret) },
    });
    return { secret, provisioningUri: getTotpProvisioningUri(secret, 'platform administrator') };
  }

  async confirmMfaSetup(setupToken: string, code: string) {
    const adminId = this.verifyMfaSetupToken(setupToken);
    const admin = await this.prisma.platformAdmin.findFirst({
      where: { id: adminId, status: 'ACTIVE' },
      select: {
        id: true,
        email: true,
        name: true,
        mfaEnabled: true,
        mfaPendingSecretEncrypted: true,
      },
    });
    if (admin?.mfaEnabled || !admin?.mfaPendingSecretEncrypted) {
      throw new ConflictException('Start platform MFA setup before confirming it.');
    }
    if (!verifyTotp(decryptMfaSecret(admin.mfaPendingSecretEncrypted), code)) {
      throw new UnauthorizedException('The authenticator code is invalid.');
    }
    const recoveryCodes = generateMfaRecoveryCodes();
    await this.prisma.$transaction(async (tx) => {
      const enabled = await tx.platformAdmin.updateMany({
        where: {
          id: admin.id,
          mfaEnabled: false,
          mfaPendingSecretEncrypted: admin.mfaPendingSecretEncrypted,
        },
        data: {
          mfaEnabled: true,
          mfaSecretEncrypted: admin.mfaPendingSecretEncrypted,
          mfaPendingSecretEncrypted: null,
        },
      });
      if (enabled.count !== 1) {
        throw new ConflictException('Platform MFA setup was already completed or replaced.');
      }
      await tx.mfaRecoveryCode.deleteMany({ where: { platformAdminId: admin.id } });
      await tx.mfaRecoveryCode.createMany({
        data: recoveryCodes.map((code) => ({
          platformAdminId: admin.id,
          tokenHash: hashOpaqueToken(code),
        })),
      });
    });
    const session = await this.createAdminSession(admin.id, {
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });
    return { ...session, recoveryCodes };
  }

  async refreshSession(refreshToken: string) {
    const tokenHash = hashOpaqueToken(refreshToken);
    const storedToken = await this.prisma.authRefreshToken.findUnique({
      where: { tokenHash },
      include: {
        session: true,
        platformAdmin: { select: { id: true, email: true, name: true, status: true, mfaEnabled: true } },
      },
    });
    const now = new Date();
    if (!storedToken) throw new UnauthorizedException('Refresh session is invalid or expired.');
    if (storedToken.consumedAt) {
      await this.prisma.authSession.updateMany({
        where: { id: storedToken.sessionId, revokedAt: null },
        data: { revokedAt: now },
      });
      throw new UnauthorizedException('Refresh token reuse detected. Sign in again.');
    }
    if (
      !storedToken.platformAdmin ||
      storedToken.platformAdmin.status !== 'ACTIVE' ||
      !storedToken.platformAdmin.mfaEnabled ||
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
    const adminId = storedToken.platformAdmin.id;
    const nextRefreshToken = createOpaqueToken();
    const nextHash = hashOpaqueToken(nextRefreshToken);
    const idleExpiresAt = new Date(Math.min(
      now.getTime() + 7 * 24 * 60 * 60 * 1000,
      storedToken.session.absoluteExpiresAt.getTime(),
    ));
    const rotated = await this.prisma.$transaction(async (tx) => {
      const consumed = await tx.authRefreshToken.updateMany({
        where: { id: storedToken.id, consumedAt: null, expiresAt: { gt: now } },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) return false;
      const updated = await tx.authSession.updateMany({
        where: {
          id: storedToken.sessionId,
          refreshTokenHash: tokenHash,
          revokedAt: null,
          idleExpiresAt: { gt: now },
          absoluteExpiresAt: { gt: now },
        },
        data: { refreshTokenHash: nextHash, lastUsedAt: now, idleExpiresAt },
      });
      if (updated.count !== 1) {
        throw new UnauthorizedException('Refresh session is invalid or expired.');
      }
      await tx.authRefreshToken.create({
        data: {
          sessionId: storedToken.sessionId,
          platformAdminId: adminId,
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
    const platformAdmin = {
      id: storedToken.platformAdmin.id,
      email: storedToken.platformAdmin.email,
      name: storedToken.platformAdmin.name,
    };
    return {
      accessToken: this.signToken(adminId, storedToken.sessionId),
      refreshToken: nextRefreshToken,
      platformAdmin,
    };
  }

  async resolvePrincipal(adminId: string): Promise<PlatformAdminPrincipal> {
    const admin = await this.prisma.platformAdmin.findFirst({
      where: { id: adminId, status: 'ACTIVE' },
      select: { id: true, email: true, name: true },
    });
    if (!admin) {
      throw new UnauthorizedException('Active platform administrator access is required.');
    }
    return admin;
  }

  async isSessionActive(sessionId: string, adminId: string): Promise<boolean> {
    const now = new Date();
    const session = await this.prisma.authSession.findFirst({
      where: {
        id: sessionId,
        platformAdminId: adminId,
        revokedAt: null,
        idleExpiresAt: { gt: now },
        absoluteExpiresAt: { gt: now },
      },
      select: { id: true },
    });
    return Boolean(session);
  }

  async revokeSession(sessionId: string, adminId: string): Promise<void> {
    await this.prisma.authSession.updateMany({
      where: { id: sessionId, platformAdminId: adminId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  verifyToken(token: string): { adminId: string; sessionId: string } {
    try {
      const payload = jwt.verify(token, this.getSecret(), { audience: 'platform' });
      if (
        typeof payload === 'string' ||
        typeof payload.platformAdminId !== 'string' ||
        typeof payload.sessionId !== 'string' ||
        payload.tokenType !== 'platform-admin'
      ) {
        throw new UnauthorizedException('Invalid or expired platform authentication token.');
      }
      return { adminId: payload.platformAdminId, sessionId: payload.sessionId };
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired platform authentication token.');
    }
  }

  private signToken(adminId: string, sessionId: string): string {
    return jwt.sign(
      { platformAdminId: adminId, sessionId, tokenType: 'platform-admin' },
      this.getSecret(),
      {
        audience: 'platform',
        subject: adminId,
        expiresIn: 15 * 60,
      },
    );
  }

  private createMfaSetupToken(adminId: string): string {
    return jwt.sign(
      { platformAdminId: adminId, tokenType: 'platform-mfa-setup' },
      this.getSecret(),
      { audience: 'platform-mfa-setup', expiresIn: 10 * 60 },
    );
  }

  private verifyMfaSetupToken(token: string): string {
    try {
      const payload = jwt.verify(token, this.getSecret(), { audience: 'platform-mfa-setup' });
      if (typeof payload === 'string' || typeof payload.platformAdminId !== 'string' ||
        payload.tokenType !== 'platform-mfa-setup') {
        throw new UnauthorizedException('Platform MFA setup session is invalid or expired.');
      }
      return payload.platformAdminId;
    } catch (error) {
      if (error instanceof UnauthorizedException) throw error;
      throw new UnauthorizedException('Platform MFA setup session is invalid or expired.');
    }
  }

  private async createAdminSession(
    adminId: string,
    platformAdmin: PlatformAdminPrincipal,
  ) {
    const now = new Date();
    const refreshToken = createOpaqueToken();
    const refreshTokenHash = hashOpaqueToken(refreshToken);
    const absoluteExpiresAt = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const session = await this.prisma.authSession.create({
      data: {
        platformAdminId: adminId,
        refreshTokenHash,
        lastUsedAt: now,
        idleExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        absoluteExpiresAt,
        refreshTokens: {
          create: {
            platformAdminId: adminId,
            tokenHash: refreshTokenHash,
            expiresAt: absoluteExpiresAt,
          },
        },
      },
      select: { id: true },
    });
    return {
      accessToken: this.signToken(adminId, session.id),
      refreshToken,
      platformAdmin,
    };
  }

  private async verifyMfaCode(
    adminId: string,
    encryptedSecret: string | null,
    code: string,
  ): Promise<boolean> {
    if (!encryptedSecret) return false;
    if (verifyTotp(decryptMfaSecret(encryptedSecret), code)) return true;
    const recoveryCode = await this.prisma.mfaRecoveryCode.findFirst({
      where: { platformAdminId: adminId, tokenHash: hashOpaqueToken(code.trim().toUpperCase()), usedAt: null },
      select: { id: true },
    });
    if (!recoveryCode) return false;
    const consumed = await this.prisma.mfaRecoveryCode.updateMany({
      where: { id: recoveryCode.id, usedAt: null },
      data: { usedAt: new Date() },
    });
    return consumed.count === 1;
  }

  private getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    return secret;
  }
}
