import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import jwt from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';
import { EmailService } from '../email/email.service';
import { hashOpaqueToken } from './auth-security';

describe('AuthService', () => {
  const prisma = {
    user: { findUnique: jest.fn(), findFirst: jest.fn(), update: jest.fn() },
    membership: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
    revokedToken: { create: jest.fn(), findFirst: jest.fn() },
    authSession: { create: jest.fn(), findFirst: jest.fn(), updateMany: jest.fn() },
    authRefreshToken: { findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    emailVerificationToken: { findUnique: jest.fn(), updateMany: jest.fn(), create: jest.fn() },
    mfaRecoveryCode: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
      createMany: jest.fn(),
      deleteMany: jest.fn(),
    },
    $transaction: jest.fn(),
  };
  const emailService = { sendPasswordReset: jest.fn() };
  let service: AuthService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'unit-test-secret-with-at-least-32-characters';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    emailService.sendPasswordReset.mockResolvedValue(undefined);
    prisma.authSession.create.mockResolvedValue({ id: 'session-1' });
    prisma.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      tenantId: 'tenant-1',
      tenant: { status: 'ACTIVE' },
      allStoreAccess: true,
      user: { email: 'owner@example.com', mfaEnabled: false },
      roles: [
        {
          role: {
            name: 'Tenant Owner',
            permissions: [{ permission: { code: 'products.view' } }],
          },
        },
      ],
      storeScopes: [],
    });
    service = new AuthService(prisma as unknown as PrismaService, emailService as unknown as EmailService);
  });

  it('authenticates only a persisted active tenant membership', async () => {
    const passwordHash = await service.hashPassword('ValidPassword123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      passwordHash,
      status: 'ACTIVE',
      emailVerifiedAt: new Date(),
      mfaEnabled: false,
      memberships: [{ id: 'membership-1' }],
    });

    const result = await service.login({
      email: 'OWNER@example.com',
      tenantSlug: 'shop-one',
      password: 'ValidPassword123!',
    });
    const token = service.verifyToken(result.accessToken);
    const signedPayload = jwt.decode(result.accessToken) as jwt.JwtPayload;

    expect(token).toEqual({ userId: 'user-1', membershipId: 'membership-1', sessionId: 'session-1' });
    expect(signedPayload).not.toHaveProperty('permissions');
    expect(result.user).toEqual(
      expect.objectContaining({
        tenantId: 'tenant-1',
        permissions: ['products.view'],
        allStoreAccess: true,
      }),
    );
  });

  it('does not authenticate when no active membership exists', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      passwordHash: await service.hashPassword('ValidPassword123!'),
      status: 'ACTIVE',
      memberships: [],
    });
    prisma.auditLog.create.mockResolvedValue({});

    await expect(
      service.login({
        email: 'owner@example.com',
        tenantSlug: 'unknown-tenant',
        password: 'ValidPassword123!',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.membership.findFirst).not.toHaveBeenCalled();
  });

  it('requires email verification before creating a tenant session', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      passwordHash: await service.hashPassword('ValidPassword123!'),
      status: 'ACTIVE',
      emailVerifiedAt: null,
      mfaEnabled: false,
      memberships: [{ id: 'membership-1' }],
    });

    await expect(service.login({
      email: 'owner@example.com',
      tenantSlug: 'shop-one',
      password: 'ValidPassword123!',
    })).rejects.toThrow(ForbiddenException);
    expect(prisma.authSession.create).not.toHaveBeenCalled();
  });

  it('consumes email verification tokens once', async () => {
    const token = 'email-verification-token-value-123456789';
    const verification = {
      id: 'verification-1',
      userId: 'user-1',
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    };
    const transaction = {
      emailVerificationToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { update: jest.fn().mockResolvedValue({}) },
    };
    prisma.emailVerificationToken.findUnique.mockResolvedValue(verification);
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    );

    await expect(service.verifyEmail(token)).resolves.toEqual({ verified: true });

    expect(prisma.emailVerificationToken.findUnique).toHaveBeenCalledWith({
      where: { tokenHash: hashOpaqueToken(token) },
      select: { id: true, userId: true, expiresAt: true, consumedAt: true },
    });
    expect(transaction.emailVerificationToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: verification.id, consumedAt: null }),
      }),
    );
    expect(transaction.user.update).toHaveBeenCalledWith({
      where: { id: verification.userId },
      data: { emailVerifiedAt: expect.any(Date) },
    });
  });

  it('revokes a tenant session when a consumed refresh token is replayed', async () => {
    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'refresh-row-1',
      sessionId: 'session-1',
      consumedAt: new Date(),
    });
    prisma.authSession.updateMany.mockResolvedValue({ count: 1 });

    await expect(service.refreshUserSession('replayed-refresh-token')).rejects.toThrow(
      'Refresh token reuse detected. Sign in again.',
    );
    expect(prisma.authSession.updateMany).toHaveBeenCalledWith({
      where: { id: 'session-1', revokedAt: null },
      data: { revokedAt: expect.any(Date) },
    });
  });

  it('rotates a valid tenant refresh token and advances the idle expiry', async () => {
    const refreshToken = 'current-refresh-token';
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    prisma.authRefreshToken.findUnique.mockResolvedValue({
      id: 'refresh-row-1',
      sessionId: 'session-1',
      consumedAt: null,
      expiresAt,
      session: {
        id: 'session-1',
        membershipId: 'membership-1',
        revokedAt: null,
        idleExpiresAt: expiresAt,
        absoluteExpiresAt: expiresAt,
      },
      user: { id: 'user-1', status: 'ACTIVE', emailVerifiedAt: new Date() },
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

    const result = await service.refreshUserSession(refreshToken);

    expect(result.refreshToken).not.toBe(refreshToken);
    expect(service.verifyToken(result.accessToken).sessionId).toBe('session-1');
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
          id: 'session-1',
          refreshTokenHash: hashOpaqueToken(refreshToken),
        }),
        data: expect.objectContaining({ idleExpiresAt: expect.any(Date) }),
      }),
    );
    expect(transaction.authRefreshToken.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sessionId: 'session-1',
          tokenHash: hashOpaqueToken(result.refreshToken),
        }),
      }),
    );
  });

  it('sends a reset link without returning the token to the API caller', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: 'user-1', status: 'ACTIVE' });
    prisma.revokedToken.create.mockResolvedValue({});

    const result = await service.forgotPassword({ email: ' OWNER@example.com ' });

    expect(result).toEqual({
      message: 'If an account exists for this address, password reset instructions will be sent.',
    });
    expect(result).not.toHaveProperty('token');
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith(
      'owner@example.com',
      expect.any(String),
    );
    const sentToken = emailService.sendPasswordReset.mock.calls[0][1] as string;
    const storedHash = prisma.revokedToken.create.mock.calls[0][0].data.tokenHash as string;
    expect(storedHash).not.toBe(sentToken);
    expect(prisma.revokedToken.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: 'user-1' }),
    });
  });

  it('returns the same response and emails a generic notice for an unknown account', async () => {
    prisma.user.findUnique.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'unknown@example.com' });

    expect(result).toEqual({
      message: 'If an account exists for this address, password reset instructions will be sent.',
    });
    expect(emailService.sendPasswordReset).toHaveBeenCalledWith('unknown@example.com', undefined);
    expect(prisma.revokedToken.create).not.toHaveBeenCalled();
  });

  it('consumes reset tokens atomically before changing the password', async () => {
    const token = jwt.sign(
      { sub: 'user-1', type: 'password_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' },
    );
    const transaction = {
      revokedToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      user: { update: jest.fn().mockResolvedValue({}) },
      authSession: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    };
    prisma.revokedToken.findFirst.mockResolvedValue({ id: 'reset-token-row' });
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    );

    await expect(service.resetPassword({ token, password: 'NewSecurePassword123!' }))
      .resolves.toBeUndefined();

    expect(transaction.revokedToken.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'reset-token-row' }),
        data: expect.objectContaining({ expiresAt: expect.any(Date) }),
      }),
    );
    expect(transaction.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: { passwordHash: expect.any(String) },
      }),
    );
  });

  it('rejects reset tokens already consumed by a concurrent request', async () => {
    const token = jwt.sign(
      { sub: 'user-1', type: 'password_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: '15m' },
    );
    const transaction = {
      revokedToken: { updateMany: jest.fn().mockResolvedValue({ count: 0 }) },
      user: { update: jest.fn() },
      authSession: { updateMany: jest.fn() },
    };
    prisma.revokedToken.findFirst.mockResolvedValue({ id: 'reset-token-row' });
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => Promise<void>) => callback(transaction),
    );

    await expect(
      service.resetPassword({ token, password: 'NewSecurePassword123!' }),
    ).rejects.toThrow('Reset token has already been used or is invalid.');
    expect(transaction.user.update).not.toHaveBeenCalled();
  });

  it('rejects expired reset tokens before looking up stored token state', async () => {
    const token = jwt.sign(
      { sub: 'user-1', type: 'password_reset' },
      process.env.JWT_SECRET!,
      { expiresIn: -1 },
    );

    await expect(
      service.resetPassword({ token, password: 'NewSecurePassword123!' }),
    ).rejects.toThrow('Invalid or expired reset token.');
    expect(prisma.revokedToken.findFirst).not.toHaveBeenCalled();
  });
});
