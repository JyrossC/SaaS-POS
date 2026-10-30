import { UnauthorizedException } from '@nestjs/common';
import * as argon2 from 'argon2';
import * as jwt from 'jsonwebtoken';
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
  };
  const prisma = {
    platformAdmin: { findUnique: jest.fn() },
    platformAuditLog: { create: jest.fn() },
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
    prisma.platformAuditLog.create.mockResolvedValue({});
    service = new PlatformAuthService(prisma as unknown as PrismaService);
  });

  it('issues a platform-audience token after successful login', async () => {
    const result = await service.login({
      email: 'ADMIN@example.com',
      password: 'A-Strong-Admin-Password-123!',
    });

    expect(result.platformAdmin).toEqual({
      id: admin.id,
      email: admin.email,
      name: admin.name,
    });
    expect(service.verifyToken(result.accessToken)).toBe(admin.id);
  });

  it('rejects a tenant-user token at the platform authentication boundary', () => {
    const tenantToken = jwt.sign(
      { membershipId: 'tenant-membership-1' },
      secret,
      { subject: 'tenant-user-1', expiresIn: 60 },
    );

    expect(() => service.verifyToken(tenantToken)).toThrow(UnauthorizedException);
  });
});
