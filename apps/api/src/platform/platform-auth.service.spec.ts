import { ConflictException, UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import { hashOpaqueToken } from '../auth/auth-security';
import { PrismaService } from '../database/prisma.service';
import { PlatformAuthService } from './platform-auth.service';

describe('PlatformAuthService', () => {
  const secret = 'unit-test-platform-secret-at-least-32-characters';
  const admin = {
    id: 'platform-admin-1',
    email: 'admin@example.com',
    name: 'Platform Admin',
    passwordHash: '',
    status: 'ACTIVE',
    mfaEnabled: false,
    mfaSecretEncrypted: null,
    mfaPendingSecretEncrypted: null,
  };
  const prisma = {
    platformAdmin: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    authSession: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    authRefreshToken: { create: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
    platformAuditLog: { create: jest.fn() },
    $transaction: jest.fn(),
  };
  let service: PlatformAuthService;

  beforeAll(async () => {
    process.env.JWT_SECRET = secret;
    admin.passwordHash = await argon2.hash('A-Strong-Admin-Password-123!', {
      type: argon2.argon2id,
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.platformAdmin.findUnique.mockResolvedValue(admin);
    prisma.platformAdmin.findFirst.mockResolvedValue(admin);
    prisma.platformAuditLog.create.mockResolvedValue({});
    prisma.platformAdmin.update.mockResolvedValue({});
    prisma.authSession.create.mockResolvedValue({ id: 'platform-session-1' });
    prisma.authSession.findFirst.mockResolvedValue({ id: 'platform-session-1' });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });
    prisma.authRefreshToken.create.mockResolvedValue({});
    prisma.authRefreshToken.updateMany.mockResolvedValue({ count: 1 });
    service = new PlatformAuthService(prisma as unknown as PrismaService);
  });

  it('requires first-time platform MFA enrollment before granting an access token', async () => {
    const result = await service.login({
      email: 'ADMIN@example.com',
      password: 'A-Strong-Admin-Password-123!',
    });

    expect(result).toEqual(expect.objectContaining({
      mfaSetupRequired: true,
      setupToken: expect.any(String),
    }));
    expect(result.platformAdmin).toEqual({
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });
    expect(result).not.toHaveProperty('accessToken');

    if (!('setupToken' in result)) throw new Error('Expected an MFA setup challenge.');
    const setup = await service.setupMfa(result.setupToken);
    expect(setup.secret).toMatch(/^[A-Z2-7]+$/);
    expect(setup.provisioningUri).toContain('otpauth://totp/');
  });

  it('does not allow a setup token to replace already-enabled platform MFA', async () => {
    const result = await service.login({
      email: 'ADMIN@example.com',
      password: 'A-Strong-Admin-Password-123!',
    });
    if (!('setupToken' in result)) throw new Error('Expected an MFA setup challenge.');
    prisma.platformAdmin.findFirst.mockResolvedValue({ ...admin, mfaEnabled: true });

    await expect(service.setupMfa(result.setupToken)).rejects.toThrow(ConflictException);
  });

  it('requires a current MFA code after platform MFA is enabled', async () => {
    prisma.platformAdmin.findUnique.mockResolvedValue({ ...admin, mfaEnabled: true });

    await expect(service.login({
      email: 'ADMIN@example.com',
      password: 'A-Strong-Admin-Password-123!',
    })).rejects.toThrow('Multi-factor code required.');
  });

  it('rotates a platform refresh token without extending the absolute session expiry', async () => {
    const refreshToken = 'current-platform-refresh-token';
    const absoluteExpiresAt = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'refresh-row-1',
      sessionId: 'platform-session-1',
      consumedAt: null,
      expiresAt: absoluteExpiresAt,
      session: {
        id: 'platform-session-1',
        revokedAt: null,
        idleExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        absoluteExpiresAt,
      },
      platformAdmin: { ...admin, mfaEnabled: true },
    });
    const transaction = {
      authRefreshToken: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        create: jest.fn().mockResolvedValue({}),
      },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<boolean>) => callback(transaction),
    );

    const result = await service.refreshSession(refreshToken);

    expect(result.refreshToken).not.toBe(refreshToken);
    expect(service.verifyToken(result.accessToken).sessionId).toBe('platform-session-1');
    expect(transaction.authRefreshToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'refresh-row-1',
          consumedAt: null,
          expiresAt: { gt: expect.any(Date) },
        }),
      }),
    );
    expect(transaction.authSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'platform-session-1',
          refreshTokenHash: hashOpaqueToken(refreshToken),
        }),
        data: expect.objectContaining({
          idleExpiresAt: absoluteExpiresAt,
        }),
      }),
    );
    expect(transaction.authRefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'platform-session-1',
          tokenHash: hashOpaqueToken(result.refreshToken),
          expiresAt: absoluteExpiresAt,
        }),
      }),
    );
  });

  it('revokes a platform session when its consumed refresh token is replayed', async () => {
    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'refresh-row-1',
      sessionId: 'platform-session-1',
      consumedAt: new Date(),
    });

    await expect(service.refreshSession('replayed-platform-refresh-token')).rejects.toThrow(
      'Refresh token reuse detected. Sign in again.',
    );
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'platform-session-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it.each(['idleExpiresAt', 'absoluteExpiresAt'] as const)(
    'revokes a platform session after its %s expires',
    async (expiryField) => {
      const future = new Date(Date.now() + 60_000);
      prisma.authRefreshToken.findUnique.mockResolvedValue({
        id: 'refresh-row-1',
        sessionId: 'platform-session-1',
        consumedAt: null,
        expiresAt: future,
        session: {
          id: 'platform-session-1',
          revokedAt: null,
          idleExpiresAt: expiryField === 'idleExpiresAt' ? new Date(Date.now() - 1) : future,
          absoluteExpiresAt: expiryField === 'absoluteExpiresAt' ? new Date(Date.now() - 1) : future,
        },
        platformAdmin: { ...admin, mfaEnabled: true },
      });

      await expect(service.refreshSession('expired-platform-refresh-token')).rejects.toThrow(
        'Refresh session is invalid or expired.',
      );
      expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
        where: { id: 'platform-session-1', revokedAt: null },
        data: { revokedAt: expect.any(Date) },
      });
    },
  );

  it('rejects a tenant-user token at the platform authentication boundary', () => {
    const tenantToken = jwt.sign(
      { membershipId: 'tenant-membership-1' },
      secret,
      { subject: 'tenant-user-1', expiresIn: 60 },
    );

    expect(() => service.verifyToken(tenantToken)).toThrow(UnauthorizedException);
  });
});
