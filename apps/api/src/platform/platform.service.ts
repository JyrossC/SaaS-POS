import {
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import * as argon2 from 'argon2';
import { createHash, timingSafeEqual } from 'node:crypto';
import { access, mkdir, open } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { PrismaService } from '../database/prisma.service';
import { InstallationRequest } from './platform.types';

@Injectable()
export class PlatformService {
  private readonly logger = new Logger(PlatformService.name);

  constructor(private readonly prisma: PrismaService) {}

  async initialize(
    request: InstallationRequest,
    installationSecret: string | undefined,
  ): Promise<{ initialized: true; platformName: string }> {
    this.assertInstallationSecret(installationSecret);

    const storageDirectory = this.getPrivateStorageDirectory();
    const lockPath = resolve(storageDirectory, 'installation-lock.json');
    const lockExists = await this.privateFileExists(lockPath);
    const installationExists = await this.prisma.platformInstallation.findUnique({
      where: { id: 'singleton' },
      select: { id: true },
    });
    if (lockExists || installationExists) {
      throw new ConflictException('This platform installation has already been initialized.');
    }

    const passwordHash = await argon2.hash(request.password, { type: argon2.argon2id });
    try {
      await this.prisma.$transaction(async (transaction) => {
        const admin = await transaction.platformAdmin.create({
          data: {
            email: request.adminEmail.trim().toLowerCase(),
            name: request.adminName.trim(),
            passwordHash,
          },
        });
        const installation = await transaction.platformInstallation.create({
          data: { id: 'singleton', platformName: request.platformName.trim() },
        });
        await transaction.platformAuditLog.create({
          data: {
            actorPlatformAdminId: admin.id,
            action: 'platform.installation.completed',
            resource: 'platform-installation',
            resourceId: installation.id,
          },
        });
      });
    } catch (error) {
      const installationAfterRace = await this.prisma.platformInstallation.findUnique({
        where: { id: 'singleton' },
        select: { id: true },
      });
      if (installationAfterRace) {
        throw new ConflictException('This platform installation has already been initialized.');
      }
      throw error;
    }

    await this.writeInstallationLock(lockPath);
    return { initialized: true, platformName: request.platformName.trim() };
  }

  async getInstallationStatus(): Promise<{ initialized: boolean }> {
    const installation = await this.prisma.platformInstallation.findUnique({
      where: { id: 'singleton' },
      select: { id: true },
    });
    const lockExists = await this.privateFileExists(
      resolve(this.getPrivateStorageDirectory(), 'installation-lock.json'),
    );
    return { initialized: installation !== null || lockExists };
  }

  async getPlatformStats(): Promise<{
    totalTenants: number;
    activeTenants: number;
    totalStores: number;
    totalProducts: number;
    totalSales: number;
    totalRevenue: number;
  }> {
    const [tenants, activeTenants, stores, products, sales, revenue] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.tenant.count({ where: { status: 'ACTIVE' } }),
      this.prisma.store.count(),
      this.prisma.product.count(),
      this.prisma.sale.count({ where: { status: 'COMPLETED' } }),
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED' },
        _sum: { totalAmount: true },
      }),
    ]);

    return {
      totalTenants: tenants,
      activeTenants,
      totalStores: stores,
      totalProducts: products,
      totalSales: sales,
      totalRevenue: Number(revenue._sum.totalAmount ?? 0),
    };
  }

  private assertInstallationSecret(providedSecret: string | undefined): void {
    const expectedSecret = process.env.INSTALLATION_SECRET;
    if (!expectedSecret || expectedSecret.length < 32) {
      throw new Error('INSTALLATION_SECRET must be configured with at least 32 characters.');
    }
    if (!providedSecret) {
      throw new UnauthorizedException('A valid one-time installation secret is required.');
    }

    const expectedDigest = createHash('sha256').update(expectedSecret).digest();
    const providedDigest = createHash('sha256').update(providedSecret).digest();
    if (!timingSafeEqual(expectedDigest, providedDigest)) {
      throw new UnauthorizedException('A valid one-time installation secret is required.');
    }
  }

  private getPrivateStorageDirectory(): string {
    const repositoryRoot = resolve(__dirname, '..', '..', '..');
    return resolve(repositoryRoot, process.env.PRIVATE_STORAGE_PATH ?? 'apps/api/var/private');
  }

  private async privateFileExists(filePath: string): Promise<boolean> {
    try {
      await access(filePath);
      return true;
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return false;
      }
      throw error;
    }
  }

  private async writeInstallationLock(lockPath: string): Promise<void> {
    await mkdir(dirname(lockPath), { recursive: true, mode: 0o700 });
    try {
      const file = await open(lockPath, 'wx', 0o600);
      try {
        await file.writeFile(
          JSON.stringify({ initializedAt: new Date().toISOString(), version: 1 }),
          'utf8',
        );
        await file.sync();
      } finally {
        await file.close();
      }
    } catch (error) {
      this.logger.error('Platform setup committed, but its installation lock file could not be written.');
      throw error;
    }
  }
}
