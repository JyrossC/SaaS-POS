import { Injectable, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { PlatformAdminPrincipal, PlatformLoginRequest } from './platform.types';

@Injectable()
export class PlatformAuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(credentials: PlatformLoginRequest): Promise<{
    accessToken: string;
    platformAdmin: PlatformAdminPrincipal;
  }> {
    const admin = await this.prisma.platformAdmin.findUnique({
      where: { email: credentials.email.trim().toLowerCase() },
    });

    if (
      !admin ||
      admin.status !== 'ACTIVE' ||
      !(await argon2.verify(admin.passwordHash, credentials.password))
    ) {
      await this.prisma.platformAuditLog.create({
        data: {
          action: 'platform.auth.login_failed',
          resource: 'platform-authentication',
          metadata: { email: credentials.email.trim().toLowerCase() },
        },
      });
      throw new UnauthorizedException('Invalid platform administrator credentials.');
    }

    await this.prisma.platformAuditLog.create({
      data: {
        actorPlatformAdminId: admin.id,
        action: 'platform.auth.login_succeeded',
        resource: 'platform-authentication',
        resourceId: admin.id,
      },
    });

    return {
      accessToken: this.signToken(admin.id),
      platformAdmin: { id: admin.id, email: admin.email, name: admin.name },
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

  verifyToken(token: string): string {
    try {
      const payload = jwt.verify(token, this.getSecret(), { audience: 'platform' });
      if (
        typeof payload === 'string' ||
        typeof payload.platformAdminId !== 'string' ||
        payload.tokenType !== 'platform-admin'
      ) {
        throw new UnauthorizedException('Invalid or expired platform authentication token.');
      }
      return payload.platformAdminId;
    } catch (error) {
      if (error instanceof UnauthorizedException) {
        throw error;
      }
      throw new UnauthorizedException('Invalid or expired platform authentication token.');
    }
  }

  private signToken(adminId: string): string {
    return jwt.sign(
      { platformAdminId: adminId, tokenType: 'platform-admin' },
      this.getSecret(),
      {
        audience: 'platform',
        subject: adminId,
        expiresIn: this.getExpiresInSeconds(),
      },
    );
  }

  private getExpiresInSeconds(): number {
    const configured = process.env.JWT_EXPIRES_IN ?? '15m';
    const match = /^([1-9]\d*)(s|m|h|d)$/.exec(configured);
    if (!match) {
      throw new Error('JWT_EXPIRES_IN must use a positive duration such as 15m or 1h.');
    }

    const multipliers: Record<string, number> = {
      s: 1,
      m: 60,
      h: 60 * 60,
      d: 24 * 60 * 60,
    };
    return Number(match[1]) * multipliers[match[2]];
  }

  private getSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.length < 32) {
      throw new Error('JWT_SECRET must be configured with at least 32 characters.');
    }
    return secret;
  }
}
