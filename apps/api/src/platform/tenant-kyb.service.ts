import {
  ConflictException,
  GoneException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { KybDocumentStatus, Prisma } from '@prisma/client';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { chmod, mkdir, open, readFile, unlink } from 'node:fs/promises';
import { basename, extname, resolve } from 'node:path';
import { inflateRawSync } from 'node:zlib';
import { PrismaService } from '../database/prisma.service';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const MAX_RETENTION_YEARS = 5;
const MIME_BY_EXTENSION: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.pdf': 'application/pdf',
  '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
};
const CRC32_TABLE = Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function isValidPng(buffer: Buffer): boolean {
  if (
    buffer.length < 45 ||
    !buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) {
    return false;
  }

  let offset = 8;
  let hasHeader = false;
  let hasImageData = false;
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > buffer.length) {
      return false;
    }
    const chunkType = buffer.subarray(offset + 4, offset + 8);
    const chunkData = buffer.subarray(offset + 8, offset + 8 + chunkLength);
    if (crc32(Buffer.concat([chunkType, chunkData])) !== buffer.readUInt32BE(offset + 8 + chunkLength)) {
      return false;
    }
    if (!hasHeader) {
      if (
        chunkType.toString('ascii') !== 'IHDR' ||
        chunkLength !== 13 ||
        chunkData.readUInt32BE(0) === 0 ||
        chunkData.readUInt32BE(4) === 0 ||
        chunkData[10] !== 0 ||
        chunkData[11] !== 0 ||
        chunkData[12] > 1
      ) {
        return false;
      }
      hasHeader = true;
    } else if (chunkType.toString('ascii') === 'IHDR') {
      return false;
    }
    if (chunkType.toString('ascii') === 'IDAT') {
      hasImageData = true;
    }
    if (chunkType.toString('ascii') === 'IEND') {
      return chunkLength === 0 && hasImageData && chunkEnd === buffer.length;
    }
    offset = chunkEnd;
  }
  return false;
}

function extractZipEntry(buffer: Buffer, offset: number, compressedSize: number, method: number) {
  if (method === 0) {
    return buffer.subarray(offset, offset + compressedSize);
  }
  if (method === 8) {
    return inflateRawSync(buffer.subarray(offset, offset + compressedSize), {
      maxOutputLength: MAX_DOCUMENT_BYTES,
    });
  }
  return undefined;
}

function isValidDocx(buffer: Buffer): boolean {
  if (buffer.length < 22) {
    return false;
  }
  const minimumEndOffset = Math.max(0, buffer.length - 65_557);
  let endRecordOffset = -1;
  for (let offset = buffer.length - 22; offset >= minimumEndOffset; offset -= 1) {
    if (buffer.readUInt32LE(offset) === 0x06054b50) {
      endRecordOffset = offset;
      break;
    }
  }
  if (endRecordOffset < 0) {
    return false;
  }

  const entryCount = buffer.readUInt16LE(endRecordOffset + 10);
  const centralDirectorySize = buffer.readUInt32LE(endRecordOffset + 12);
  const centralDirectoryOffset = buffer.readUInt32LE(endRecordOffset + 16);
  if (
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff ||
    centralDirectoryOffset + centralDirectorySize > endRecordOffset
  ) {
    return false;
  }

  const requiredFiles = new Map<string, Buffer>();
  let entryOffset = centralDirectoryOffset;
  for (let entry = 0; entry < entryCount; entry += 1) {
    if (
      entryOffset + 46 > buffer.length ||
      buffer.readUInt32LE(entryOffset) !== 0x02014b50
    ) {
      return false;
    }
    const method = buffer.readUInt16LE(entryOffset + 10);
    const expectedCrc = buffer.readUInt32LE(entryOffset + 16);
    const compressedSize = buffer.readUInt32LE(entryOffset + 20);
    const uncompressedSize = buffer.readUInt32LE(entryOffset + 24);
    const filenameLength = buffer.readUInt16LE(entryOffset + 28);
    const extraLength = buffer.readUInt16LE(entryOffset + 30);
    const commentLength = buffer.readUInt16LE(entryOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(entryOffset + 42);
    const entryEnd = entryOffset + 46 + filenameLength + extraLength + commentLength;
    if (entryEnd > buffer.length || uncompressedSize > MAX_DOCUMENT_BYTES) {
      return false;
    }
    const filename = buffer
      .subarray(entryOffset + 46, entryOffset + 46 + filenameLength)
      .toString('utf8');
    if (filename === '[Content_Types].xml' || filename === 'word/document.xml') {
      if (
        localHeaderOffset + 30 > buffer.length ||
        buffer.readUInt32LE(localHeaderOffset) !== 0x04034b50
      ) {
        return false;
      }
      const localFilenameLength = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLength = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataOffset = localHeaderOffset + 30 + localFilenameLength + localExtraLength;
      if (dataOffset + compressedSize > buffer.length) {
        return false;
      }
      try {
        const content = extractZipEntry(buffer, dataOffset, compressedSize, method);
        if (!content || content.length !== uncompressedSize || crc32(content) !== expectedCrc) {
          return false;
        }
        requiredFiles.set(filename, content);
      } catch {
        return false;
      }
    }
    entryOffset = entryEnd;
  }

  const contentTypes = requiredFiles.get('[Content_Types].xml')?.toString('utf8') ?? '';
  const document = requiredFiles.get('word/document.xml')?.toString('utf8') ?? '';
  return (
    requiredFiles.size === 2 &&
    contentTypes.includes('<Types') &&
    contentTypes.includes('<Override') &&
    document.includes('<w:document') &&
    document.includes('<w:body')
  );
}

export interface UploadedKybFile {
  originalname: string;
  buffer: Buffer;
  size: number;
}

export interface KybDocumentMetadata {
  id: string;
  tenantId: string;
  documentName: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  retentionExpiresAt: Date;
  reviewStatus: KybDocumentStatus;
  reviewNote: string | null;
  createdAt: Date;
}

@Injectable()
export class TenantKybService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TenantKybService.name);
  private readonly retentionSweepIntervalMs = 15 * 60 * 1000;
  private retentionSweepTimer?: ReturnType<typeof setInterval>;
  private retentionSweepRunning = false;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    this.retentionSweepTimer = setInterval(() => {
      void this.purgeExpiredDocuments().catch((error: unknown) => {
        this.logger.error(
          'KYB retention cleanup failed.',
          error instanceof Error ? error.stack : undefined,
        );
      });
    }, this.retentionSweepIntervalMs);
    this.retentionSweepTimer.unref();
    void this.purgeExpiredDocuments().catch((error: unknown) => {
      this.logger.error(
        'Initial KYB retention cleanup failed.',
        error instanceof Error ? error.stack : undefined,
      );
    });
  }

  onModuleDestroy(): void {
    if (this.retentionSweepTimer) {
      clearInterval(this.retentionSweepTimer);
    }
  }

  async upload(
    tenantId: string,
    platformAdminId: string,
    documentName: string,
    file: UploadedKybFile,
  ): Promise<KybDocumentMetadata> {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, status: true },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant was not found.');
    }
    if (tenant.status !== 'PENDING_REVIEW') {
      throw new ConflictException('KYB documents can only be submitted for tenants pending review.');
    }
    if (!file?.buffer?.length) {
      throw new UnsupportedMediaTypeException('A non-empty KYB document is required.');
    }
    if (file.size > MAX_DOCUMENT_BYTES || file.buffer.length > MAX_DOCUMENT_BYTES) {
      throw new PayloadTooLargeException('KYB documents must not exceed 10 MB.');
    }

    const mimeType = this.detectMimeType(file);
    const key = this.getEncryptionKey();
    const documentId = randomBytes(16).toString('hex');
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', key, iv);
    cipher.setAAD(Buffer.from(documentId, 'utf8'));
    const encrypted = Buffer.concat([cipher.update(file.buffer), cipher.final()]);
    const authTag = cipher.getAuthTag();
    const storageDirectory = resolve(this.getPrivateStorageDirectory(), 'kyb');
    const storagePath = resolve(storageDirectory, `${documentId}.enc`);
    const originalFilename = this.getSafeOriginalFilename(file.originalname);
    const retentionExpiresAt = new Date();
    retentionExpiresAt.setUTCFullYear(retentionExpiresAt.getUTCFullYear() + MAX_RETENTION_YEARS);

    await mkdir(storageDirectory, { recursive: true, mode: 0o700 });
    await chmod(storageDirectory, 0o700);
    const storageFile = await open(storagePath, 'wx', 0o600);
    try {
      await storageFile.writeFile(encrypted);
      await storageFile.sync();
    } catch (error) {
      try {
        await unlink(storagePath);
      } catch (cleanupError) {
        this.logger.error(
          `Could not remove incomplete encrypted KYB file (${documentId}).`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }
      throw error;
    } finally {
      await storageFile.close();
    }

    let document: KybDocumentMetadata;
    try {
      document = await this.prisma.$transaction(async (transaction) => {
        const created = await transaction.tenantKybDocument.create({
          data: {
            id: documentId,
            tenantId,
            documentName: documentName.trim(),
            originalFilename,
            mimeType,
            sizeBytes: file.buffer.length,
            encryptionIv: iv.toString('base64'),
            encryptionAuthTag: authTag.toString('base64'),
            retentionExpiresAt,
          },
          select: this.documentMetadataSelect(),
        });
        await transaction.platformAuditLog.create({
          data: {
            actorPlatformAdminId: platformAdminId,
            action: 'platform.tenant.kyb_document_uploaded',
            resource: 'tenant-kyb-document',
            resourceId: created.id,
            metadata: { tenantId, mimeType, sizeBytes: file.buffer.length },
          },
        });
        return created;
      });
    } catch (error) {
      try {
        await unlink(storagePath);
      } catch (cleanupError) {
        this.logger.error(
          `Could not remove encrypted KYB file after metadata transaction failed (${documentId}).`,
          cleanupError instanceof Error ? cleanupError.stack : undefined,
        );
      }
      throw error;
    }
    return document;
  }

  async list(tenantId: string): Promise<KybDocumentMetadata[]> {
    return this.prisma.tenantKybDocument.findMany({
      where: { tenantId },
      select: this.documentMetadataSelect(),
      orderBy: { createdAt: 'desc' },
    });
  }

  async download(
    tenantId: string,
    documentId: string,
    platformAdminId: string,
  ): Promise<{ filename: string; mimeType: string; content: Buffer }> {
    const document = await this.prisma.tenantKybDocument.findFirst({
      where: { id: documentId, tenantId },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        encryptionIv: true,
        encryptionAuthTag: true,
        retentionExpiresAt: true,
      },
    });
    if (!document) {
      throw new NotFoundException('KYB document was not found.');
    }
    if (document.retentionExpiresAt <= new Date()) {
      throw new GoneException('This KYB document has expired under the retention policy.');
    }

    await this.prisma.platformAuditLog.create({
      data: {
        actorPlatformAdminId: platformAdminId,
        action: 'platform.tenant.kyb_document_accessed',
        resource: 'tenant-kyb-document',
        resourceId: document.id,
        metadata: { tenantId },
      },
    });
    const ciphertext = await readFile(this.getDocumentPath(document.id));
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.getEncryptionKey(),
      Buffer.from(document.encryptionIv, 'base64'),
    );
    decipher.setAAD(Buffer.from(document.id, 'utf8'));
    decipher.setAuthTag(Buffer.from(document.encryptionAuthTag, 'base64'));
    const content = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    return { filename: document.originalFilename, mimeType: document.mimeType, content };
  }

  async review(
    tenantId: string,
    documentId: string,
    platformAdminId: string,
    status: Exclude<KybDocumentStatus, 'PENDING'>,
    note?: string,
  ): Promise<KybDocumentMetadata> {
    const existing = await this.prisma.tenantKybDocument.findFirst({
      where: { id: documentId, tenantId },
      select: { id: true },
    });
    if (!existing) {
      throw new NotFoundException('KYB document was not found.');
    }

    return this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.tenantKybDocument.update({
        where: { id: existing.id },
        data: {
          reviewStatus: status,
          reviewedByPlatformAdminId: platformAdminId,
          reviewNote: note?.trim() || null,
        },
        select: this.documentMetadataSelect(),
      });
      await transaction.platformAuditLog.create({
        data: {
          actorPlatformAdminId: platformAdminId,
          action: `platform.tenant.kyb_document_${status.toLowerCase()}`,
          resource: 'tenant-kyb-document',
          resourceId: updated.id,
          metadata: { tenantId, note: note?.trim() || null },
        },
      });
      return updated;
    });
  }

  async approveTenant(tenantId: string, platformAdminId: string): Promise<void> {
    const now = new Date();
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        status: true,
        kybDocuments: {
          where: { reviewStatus: 'ACCEPTED' },
          select: { id: true },
          take: 1,
        },
        subscription: {
          select: { status: true, startsAt: true, endsAt: true },
        },
      },
    });
    if (!tenant) {
      throw new NotFoundException('Tenant was not found.');
    }
    if (tenant.status !== 'PENDING_REVIEW') {
      throw new ConflictException('Only tenants pending review can be approved.');
    }
    if (tenant.kybDocuments.length === 0) {
      throw new ConflictException('At least one accepted KYB document is required.');
    }
    if (
      !tenant.subscription ||
      !['ACTIVE', 'TRIALING'].includes(tenant.subscription.status) ||
      tenant.subscription.startsAt > now ||
      (tenant.subscription.endsAt !== null && tenant.subscription.endsAt <= now)
    ) {
      throw new ConflictException('A current active plan or trial is required for tenant approval.');
    }

    await this.prisma.$transaction(async (transaction) => {
      const result = await transaction.tenant.updateMany({
        where: { id: tenant.id, status: 'PENDING_REVIEW' },
        data: { status: 'ACTIVE' },
      });
      if (result.count !== 1) {
        throw new ConflictException('Tenant status changed before approval was completed.');
      }
      await transaction.platformAuditLog.create({
        data: {
          actorPlatformAdminId: platformAdminId,
          action: 'platform.tenant.approved',
          resource: 'tenant',
          resourceId: tenant.id,
          metadata: { acceptedKybDocumentId: tenant.kybDocuments[0].id },
        },
      });
    });
  }

  async purgeExpiredDocuments(): Promise<void> {
    if (this.retentionSweepRunning) {
      return;
    }
    this.retentionSweepRunning = true;
    try {
      const now = new Date();
      while (true) {
        const expiredDocuments = await this.prisma.tenantKybDocument.findMany({
          where: { retentionExpiresAt: { lte: now } },
          select: { id: true },
          orderBy: { retentionExpiresAt: 'asc' },
          take: 100,
        });
        if (expiredDocuments.length === 0) {
          return;
        }
        for (const document of expiredDocuments) {
          try {
            await unlink(this.getDocumentPath(document.id));
          } catch (error) {
            if (
              typeof error !== 'object' ||
              error === null ||
              !('code' in error) ||
              error.code !== 'ENOENT'
            ) {
              throw error;
            }
          }
        }
        await this.prisma.$transaction(async (transaction) => {
          const result = await transaction.tenantKybDocument.deleteMany({
            where: {
              id: { in: expiredDocuments.map(({ id }) => id) },
              retentionExpiresAt: { lte: now },
            },
          });
          if (result.count > 0) {
            await transaction.platformAuditLog.create({
              data: {
                action: 'platform.tenant.kyb_documents_expired',
                resource: 'tenant-kyb-document',
                metadata: { deletedCount: result.count },
              },
            });
          }
        });
      }
    } finally {
      this.retentionSweepRunning = false;
    }
  }

  private documentMetadataSelect(): Prisma.TenantKybDocumentSelect {
    return {
      id: true,
      tenantId: true,
      documentName: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      retentionExpiresAt: true,
      reviewStatus: true,
      reviewNote: true,
      createdAt: true,
    };
  }

  private detectMimeType(file: UploadedKybFile): string {
    const extension = extname(file.originalname.toLowerCase());
    const expectedType = MIME_BY_EXTENSION[extension];
    const buffer = file.buffer;
    let detectedType: string | undefined;
    if (isValidPng(buffer)) {
      detectedType = 'image/png';
    } else if (
      buffer.length >= 8 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff &&
      buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9])) &&
      [0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].some(
        (marker) => buffer.includes(Buffer.from([0xff, marker])),
      ) &&
      buffer.includes(Buffer.from([0xff, 0xda]))
    ) {
      detectedType = 'image/jpeg';
    } else if (
      buffer.subarray(0, 5).toString('ascii') === '%PDF-' &&
      buffer.subarray(-32).toString('latin1').trimEnd().endsWith('%%EOF')
    ) {
      detectedType = 'application/pdf';
    } else if (
      buffer.subarray(0, 4).equals(Buffer.from([0x50, 0x4b, 0x03, 0x04])) &&
      isValidDocx(buffer)
    ) {
      detectedType = MIME_BY_EXTENSION['.docx'];
    }

    if (!expectedType || detectedType !== expectedType) {
      throw new UnsupportedMediaTypeException(
        'KYB documents must be valid PNG, JPG, JPEG, PDF, or DOCX files.',
      );
    }
    return detectedType;
  }

  private getSafeOriginalFilename(filename: string): string {
    const safeFilename = [...basename(filename.replace(/\\/g, '/'))]
      .filter((character) => {
        const code = character.charCodeAt(0);
        return code >= 32 && code !== 127;
      })
      .join('')
      .trim();
    if (!safeFilename || safeFilename.length > 255) {
      throw new UnsupportedMediaTypeException('The KYB document filename is invalid.');
    }
    return safeFilename;
  }

  private getEncryptionKey(): Buffer {
    const configured = process.env.KYB_DOCUMENT_ENCRYPTION_KEY;
    if (!configured) {
      throw new Error('KYB_DOCUMENT_ENCRYPTION_KEY must be configured for KYB document handling.');
    }
    const key = Buffer.from(configured, 'base64');
    if (key.length !== 32 || key.toString('base64') !== configured) {
      throw new Error('KYB_DOCUMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
    }
    return key;
  }

  private getPrivateStorageDirectory(): string {
    const repositoryRoot = resolve(__dirname, '..', '..', '..');
    return resolve(repositoryRoot, process.env.PRIVATE_STORAGE_PATH ?? 'apps/api/var/private');
  }

  private getDocumentPath(documentId: string): string {
    return resolve(this.getPrivateStorageDirectory(), 'kyb', `${documentId}.enc`);
  }
}
