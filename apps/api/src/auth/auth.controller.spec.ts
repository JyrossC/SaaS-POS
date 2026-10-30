import { UnauthorizedException } from '@nestjs/common';
import * as jwt from 'jsonwebtoken';
import { PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const prisma = {
    user: { findUnique: jest.fn() },
    membership: { findFirst: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  let service: AuthService;

  beforeAll(() => {
    process.env.JWT_SECRET = 'unit-test-secret-with-at-least-32-characters';
  });

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AuthService(prisma as unknown as PrismaService);
  });

  it('authenticates only a persisted active tenant membership', async () => {
    const passwordHash = await service.hashPassword('ValidPassword123!');
    prisma.user.findUnique.mockResolvedValue({
      id: 'user-1',
      email: 'owner@example.com',
      passwordHash,
      status: 'ACTIVE',
      memberships: [{ id: 'membership-1' }],
    });
    prisma.membership.findFirst.mockResolvedValue({
      id: 'membership-1',
      tenantId: 'tenant-1',
      allStoreAccess: true,
      user: { email: 'owner@example.com' },
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

    const result = await service.login({
      email: 'OWNER@example.com',
      tenantSlug: 'shop-one',
      password: 'ValidPassword123!',
    });
    const token = service.verifyToken(result.accessToken);
    const signedPayload = jwt.decode(result.accessToken) as jwt.JwtPayload;

    expect(token).toEqual({ userId: 'user-1', membershipId: 'membership-1' });
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
});
