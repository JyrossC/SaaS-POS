import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';

export interface JobPayload {
  type: string;
  data: Record<string, unknown>;
  tenantId?: string;
}

export interface EnqueueJobInput {
  type: string;
  data: Record<string, unknown>;
  tenantId?: string;
  maxAttempts?: number;
  runAt?: Date;
}

@Injectable()
export class JobQueueService {
  private readonly logger = new Logger(JobQueueService.name);

  constructor(private readonly prisma: PrismaService) {}

  async enqueue(input: EnqueueJobInput) {
    const runAt = input.runAt || new Date();
    return this.prisma.backgroundJob.create({
      data: {
        type: input.type,
        status: 'PENDING',
        payload: input.data as Prisma.InputJsonValue,
        tenantId: input.tenantId ?? null,
        maxAttempts: input.maxAttempts ?? 3,
        attempts: 0,
        nextRunAt: runAt,
      },
    });
  }

  async getDueJobs(limit = 50) {
    const now = new Date();
    return this.prisma.backgroundJob.findMany({
      where: {
        status: 'PENDING',
        nextRunAt: { lte: now },
      },
      orderBy: [{ nextRunAt: 'asc' }],
      take: limit,
    });
  }

  async markProcessing(jobId: string) {
    return this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: 'PROCESSING', attempts: { increment: 1 } },
    });
  }

  async markCompleted(jobId: string) {
    return this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: { status: 'COMPLETED', completedAt: new Date() },
    });
  }

  async markFailed(jobId: string, error: string, maxAttempts: number) {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!job) return null;

    const attempts = job.attempts + 1;
    if (attempts >= maxAttempts) {
      return this.prisma.backgroundJob.update({
        where: { id: jobId },
        data: { status: 'FAILED', lastError: error, completedAt: new Date() },
      });
    }

    // Exponential backoff: 2^attempts minutes
    const backoffMinutes = Math.pow(2, attempts);
    const nextRunAt = new Date(Date.now() + backoffMinutes * 60 * 1000);
    return this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        attempts,
        lastError: error,
        nextRunAt,
      },
    });
  }

  async getJobStats() {
    const [pending, processing, completed, failed, total] = await Promise.all([
      this.prisma.backgroundJob.count({ where: { status: 'PENDING' } }),
      this.prisma.backgroundJob.count({ where: { status: 'PROCESSING' } }),
      this.prisma.backgroundJob.count({ where: { status: 'COMPLETED' } }),
      this.prisma.backgroundJob.count({ where: { status: 'FAILED' } }),
      this.prisma.backgroundJob.count(),
    ]);
    return { pending, processing, completed, failed, total };
  }

  async getFailedJobs(limit = 50) {
    return this.prisma.backgroundJob.findMany({
      where: { status: 'FAILED' },
      orderBy: [{ updatedAt: 'desc' }],
      take: limit,
    });
  }

  async retryFailedJob(jobId: string) {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!job || job.status !== 'FAILED') {
      throw new Error('Job not found or not in failed state');
    }

    return this.prisma.backgroundJob.update({
      where: { id: jobId },
      data: {
        status: 'PENDING',
        attempts: 0,
        lastError: null,
        nextRunAt: new Date(),
        completedAt: null,
      },
    });
  }
}

@Injectable()
export class JobProcessor {
  private readonly logger = new Logger(JobProcessor.name);

  constructor(private readonly prisma: PrismaService, private readonly queue: JobQueueService) {}

  async processJob(jobId: string): Promise<void> {
    const job = await this.prisma.backgroundJob.findUnique({
      where: { id: jobId },
    });
    if (!job) {
      this.logger.warn(`Job ${jobId} not found`);
      return;
    }

    if (job.status !== 'PENDING' && job.status !== 'PROCESSING') {
      this.logger.warn(`Job ${jobId} is not processable (status: ${job.status})`);
      return;
    }

    await this.queue.markProcessing(jobId);

    try {
      this.logger.log(`Processing job: ${job.type} (id: ${jobId})`);
      await this.executeJobType(job.type, job.payload as Record<string, unknown>);
      await this.queue.markCompleted(jobId);
      this.logger.log(`Job ${jobId} completed successfully`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const maxAttempts = job.maxAttempts;
      await this.queue.markFailed(jobId, errorMessage, maxAttempts);
      this.logger.error(`Job ${jobId} failed: ${errorMessage}`);
    }
  }

  async processDueJobs(limit = 50): Promise<{ processed: number; succeeded: number; failed: number }> {
    const dueJobs = await this.queue.getDueJobs(limit);
    let succeeded = 0;
    let failed = 0;

    for (const job of dueJobs) {
      try {
        await this.processJob(job.id);
        // Check if the job ended up completed
        const updated = await this.prisma.backgroundJob.findUnique({
          where: { id: job.id },
          select: { status: true },
        });
        if (updated?.status === 'COMPLETED') succeeded++;
        else if (updated?.status === 'FAILED') failed++;
        else succeeded++; // still pending due to retry scheduling
      } catch {
        failed++;
      }
    }

    return { processed: dueJobs.length, succeeded, failed };
  }

  private async executeJobType(type: string, data: Record<string, unknown>): Promise<void> {
    switch (type) {
      case 'kyb_purge_expired':
        await this.purgeExpiredKybDocuments();
        break;
      case 'send_email':
        await this.sendEmail(data);
        break;
      case 'generate_report':
        await this.generateReport(data);
        break;
      default:
        this.logger.warn(`Unknown job type: ${type}`);
    }
  }

  private async purgeExpiredKybDocuments(): Promise<void> {
    const now = new Date();
    const expired = await this.prisma.tenantKybDocument.findMany({
      where: {
        retentionExpiresAt: { lte: now },
      },
    });

    for (const doc of expired) {
      await this.prisma.tenantKybDocument.delete({ where: { id: doc.id } });
      this.logger.log(`Purged expired KYB document: ${doc.id}`);
    }
  }

  private async sendEmail(data: Record<string, unknown>): Promise<void> {
    // Placeholder for email sending — integrate with an email provider in production
    this.logger.log(`Sending email: ${JSON.stringify(data)}`);
  }

  private async generateReport(data: Record<string, unknown>): Promise<void> {
    // Placeholder for report generation — integrate with reporting service in production
    this.logger.log(`Generating report: ${JSON.stringify(data)}`);
  }
}
