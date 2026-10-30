import {
  ConflictException,
  GoneException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { KybDocumentStatus } from '@prisma/client';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { deflateSync } from 'node:zlib';
import { PrismaService } from '../database/prisma.service';
import { TenantKybService } from './tenant-kyb.service';

describe('TenantKybService', () => {
  const tenantId = 'tenant-1';
  const platformAdminId = 'platform-admin-1';
  const documentId = 'fixture-document-id';
  const key = Buffer.alloc(32, 7).toString('base64');
  const metadata = {
    id: documentId,
    tenantId,
    documentName: 'Business registration',
    originalFilename: 'registration.png',
    mimeType: 'image/png',
    sizeBytes: 24,
    retentionExpiresAt: new Date('2031-01-01T00:00:00.000Z'),
    reviewStatus: 'PENDING' as KybDocumentStatus,
    reviewNote: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
  };
  const transaction = {
    tenantKybDocument: { create: jest.fn(), update: jest.fn(), deleteMany: jest.fn() },
    platformAuditLog: { create: jest.fn() },
    tenant: { updateMany: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    tenantKybDocument: { findMany: jest.fn(), findFirst: jest.fn() },
    tenant: { findUnique: jest.fn() },
    platformAuditLog: { create: jest.fn() },
  };
  const previousStoragePath = process.env.PRIVATE_STORAGE_PATH;
  const previousEncryptionKey = process.env.KYB_DOCUMENT_ENCRYPTION_KEY;
  let storagePath: string;
  let service: TenantKybService;

  function createPng(): Buffer {
    const checksum = (value: Buffer) => {
      let crc = 0xffffffff;
      for (const byte of value) {
        crc ^= byte;
        for (let bit = 0; bit < 8; bit += 1) {
          crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
        }
      }
      return (crc ^ 0xffffffff) >>> 0;
    };
    const chunk = (name: string, data: Buffer) => {
      const type = Buffer.from(name, 'ascii');
      const length = Buffer.alloc(4);
      length.writeUInt32BE(data.length);
      const crc = Buffer.alloc(4);
      crc.writeUInt32BE(checksum(Buffer.concat([type, data])));
      return Buffer.concat([length, type, data, crc]);
    };
    const header = Buffer.alloc(13);
    header.writeUInt32BE(1, 0);
    header.writeUInt32BE(1, 4);
    header[8] = 8;
    header[9] = 6;
    return Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      chunk('IHDR', header),
      chunk('IDAT', deflateSync(Buffer.from([0, 0, 0, 0, 0]))),
      chunk('IEND', Buffer.alloc(0)),
    ]);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    storagePath = await mkdtemp(join(tmpdir(), 'saas-pos-kyb-'));
    process.env.PRIVATE_STORAGE_PATH = storagePath;
    process.env.KYB_DOCUMENT_ENCRYPTION_KEY = key;
    prisma.$transaction.mockImplementation(
      async (callback: (tx: typeof transaction) => unknown) => callback(transaction),
    );
    transaction.tenantKybDocument.create.mockResolvedValue(metadata);
    transaction.tenantKybDocument.update.mockResolvedValue({
      ...metadata,
      reviewStatus: 'ACCEPTED',
    });
    transaction.tenantKybDocument.deleteMany.mockResolvedValue({ count: 1 });
    transaction.platformAuditLog.create.mockResolvedValue({});
    transaction.tenant.updateMany.mockResolvedValue({ count: 1 });
    prisma.platformAuditLog.create.mockResolvedValue({});
    prisma.tenant.findUnique.mockResolvedValue({ id: tenantId, status: 'PENDING_REVIEW' });
    service = new TenantKybService(prisma as unknown as PrismaService);
  });

  afterEach(async () => {
    await rm(storagePath, { recursive: true, force: true });
  });

  afterAll(() => {
    if (previousStoragePath === undefined) {
      delete process.env.PRIVATE_STORAGE_PATH;
    } else {
      process.env.PRIVATE_STORAGE_PATH = previousStoragePath;
    }
    if (previousEncryptionKey === undefined) {
      delete process.env.KYB_DOCUMENT_ENCRYPTION_KEY;
    } else {
      process.env.KYB_DOCUMENT_ENCRYPTION_KEY = previousEncryptionKey;
    }
  });

  it('encrypts accepted file content before persisting metadata and an audit event', async () => {
    const content = createPng();
    const result = await service.upload(tenantId, platformAdminId, 'Business registration', {
      originalname: 'registration.png',
      buffer: content,
      size: content.length,
    });

    expect(result).toEqual(metadata);
    const createdData = transaction.tenantKybDocument.create.mock.calls[0][0].data as {
      id: string;
    };
    const encrypted = await readFile(join(storagePath, 'kyb', `${createdData.id}.enc`));
    expect(encrypted).not.toEqual(content);
    expect(transaction.tenantKybDocument.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encryptionIv: expect.any(String),
          encryptionAuthTag: expect.any(String),
        }),
      }),
    );
    expect(transaction.platformAuditLog.create).toHaveBeenCalled();

    const persisted = transaction.tenantKybDocument.create.mock.calls[0][0].data as {
      id: string;
      encryptionIv: string;
      encryptionAuthTag: string;
    };
    prisma.tenantKybDocument.findFirst.mockResolvedValue({
      id: persisted.id,
      originalFilename: 'registration.png',
      mimeType: 'image/png',
      encryptionIv: persisted.encryptionIv,
      encryptionAuthTag: persisted.encryptionAuthTag,
      retentionExpiresAt: new Date(Date.now() + 60_000),
    });
    await expect(service.download(tenantId, persisted.id, platformAdminId)).resolves.toEqual({
      filename: 'registration.png',
      mimeType: 'image/png',
      content,
    });
  });

  it('rejects content that does not match an allowed extension', async () => {
    await expect(
      service.upload(tenantId, platformAdminId, 'Registration', {
        originalname: 'registration.png',
        buffer: Buffer.from('not a PNG file'),
        size: 14,
      }),
    ).rejects.toThrow(UnsupportedMediaTypeException);
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('enforces the 10 MB upload limit', async () => {
    await expect(
      service.upload(tenantId, platformAdminId, 'Registration', {
        originalname: 'registration.png',
        buffer: Buffer.alloc(10 * 1024 * 1024 + 1),
        size: 10 * 1024 * 1024 + 1,
      }),
    ).rejects.toThrow(PayloadTooLargeException);
  });

  it('does not approve a pending tenant without accepted KYB and an active plan', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: tenantId,
      status: 'PENDING_REVIEW',
      kybDocuments: [],
      subscription: null,
    });

    await expect(service.approveTenant(tenantId, platformAdminId)).rejects.toThrow(
      ConflictException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('activates a pending tenant only after accepted KYB and a current subscription', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      id: tenantId,
      status: 'PENDING_REVIEW',
      kybDocuments: [{ id: 'accepted-document' }],
      subscription: {
        status: 'ACTIVE',
        startsAt: new Date(Date.now() - 60_000),
        endsAt: null,
      },
    });

    await expect(service.approveTenant(tenantId, platformAdminId)).resolves.toBeUndefined();
    expect(transaction.tenant.updateMany).toHaveBeenCalledWith({
      where: { id: tenantId, status: 'PENDING_REVIEW' },
      data: { status: 'ACTIVE' },
    });
    expect(transaction.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'platform.tenant.approved',
          resourceId: tenantId,
        }),
      }),
    );
  });

  it('purges expired encrypted files and records a platform audit event', async () => {
    await mkdir(join(storagePath, 'kyb'));
    const expiredId = 'expired-document';
    const filePath = join(storagePath, 'kyb', `${expiredId}.enc`);
    await writeFile(filePath, 'encrypted payload');
    prisma.tenantKybDocument.findMany
      .mockResolvedValueOnce([{ id: expiredId }])
      .mockResolvedValueOnce([]);

    await service.purgeExpiredDocuments();

    await expect(readFile(filePath)).rejects.toMatchObject({ code: 'ENOENT' });
    expect(transaction.tenantKybDocument.deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: { in: [expiredId] } }),
      }),
    );
    expect(transaction.platformAuditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'platform.tenant.kyb_documents_expired',
        }),
      }),
    );
  });

  it('blocks access to documents after their retention deadline', async () => {
    prisma.tenantKybDocument.findFirst.mockResolvedValue({
      id: 'expired-document',
      originalFilename: 'registration.png',
      mimeType: 'image/png',
      encryptionIv: 'iv',
      encryptionAuthTag: 'tag',
      retentionExpiresAt: new Date(Date.now() - 1),
    });

    await expect(
      service.download(tenantId, 'expired-document', platformAdminId),
    ).rejects.toThrow(GoneException);
    expect(prisma.platformAuditLog.create).not.toHaveBeenCalled();
  });
});
