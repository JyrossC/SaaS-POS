import { ConflictException, UnauthorizedException } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { PlatformService } from './platform.service';

describe('PlatformService', () => {
  const transaction = {
    platformAdmin: { create: jest.fn() },
    platformInstallation: { create: jest.fn() },
    platformAuditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    platformInstallation: { findUnique: jest.fn() },
  };
  let service: PlatformService;
  let storagePath: string;

  beforeAll(() => {
    process.env.INSTALLATION_SECRET = 'unit-test-installation-secret-at-least-32';
    process.env.JWT_SECRET = 'unit-test-platform-secret-at-least-32-characters';
  });

  beforeEach(async () => {
    jest.clearAllMocks();
    storagePath = await mkdtemp(join(tmpdir(), 'saas-pos-platform-install-'));
    process.env.PRIVATE_STORAGE_PATH = storagePath;
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) => callback(transaction),
    );
    prisma.platformInstallation.findUnique.mockResolvedValue(null);
    transaction.platformAdmin.create.mockResolvedValue({ id: 'platform-admin-1' });
    transaction.platformInstallation.create.mockResolvedValue({
      id: 'singleton',
      platformName: 'Test Platform',
    });
    transaction.platformAuditLog.create.mockResolvedValue({});
    service = new PlatformService(prisma as unknown as PrismaService);
  });

  afterEach(async () => {
    await rm(storagePath, { recursive: true, force: true });
  });

  it('creates the initial admin, platform config, audit record, and deployment lock', async () => {
    const result = await service.initialize(
      {
        platformName: ' Test Platform ',
        adminName: ' First Admin ',
        adminEmail: 'ADMIN@example.com',
        password: 'A-Strong-Admin-Password-123!',
      },
      process.env.INSTALLATION_SECRET,
    );

    expect(result).toEqual({ initialized: true, platformName: 'Test Platform' });
    expect(transaction.platformAdmin.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          email: 'admin@example.com',
          name: 'First Admin',
          passwordHash: expect.stringMatching(/^\$argon2id\$/),
        }),
      }),
    );
    expect(transaction.platformAuditLog.create).toHaveBeenCalled();
    const lock = JSON.parse(
      await readFile(join(storagePath, 'installation-lock.json'), 'utf8'),
    ) as { initializedAt: string; version: number };
    expect(lock.version).toBe(1);
    expect(Number.isNaN(Date.parse(lock.initializedAt))).toBe(false);
  });

  it('does not create records when the installation secret is invalid', async () => {
    await expect(
      service.initialize(
        {
          platformName: 'Test Platform',
          adminName: 'First Admin',
          adminEmail: 'admin@example.com',
          password: 'A-Strong-Admin-Password-123!',
        },
        'incorrect-secret',
      ),
    ).rejects.toThrow(UnauthorizedException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses installation when the filesystem lock already exists', async () => {
    const { writeFile } = await import('node:fs/promises');
    await writeFile(join(storagePath, 'installation-lock.json'), '{}');

    await expect(
      service.initialize(
        {
          platformName: 'Test Platform',
          adminName: 'First Admin',
          adminEmail: 'admin@example.com',
          password: 'A-Strong-Admin-Password-123!',
        },
        process.env.INSTALLATION_SECRET,
      ),
    ).rejects.toThrow(ConflictException);
    await expect(service.getInstallationStatus()).resolves.toEqual({ initialized: true });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });
});
