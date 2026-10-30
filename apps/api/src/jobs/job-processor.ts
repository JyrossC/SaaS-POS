import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';

export interface JobPayload {
  type: string;
  data: Record<string, unknown>;
  tenantId?: string;
}

@Injectable()
export class JobProcessor {
  private readonly logger = new Logger(JobProcessor.name);

  constructor(private readonly prisma: PrismaService) {}

  async processJob(job: JobPayload): Promise<void> {
    this.logger.log(`Processing job: ${job.type}`);

    switch (job.type) {
      case 'kyb_purge_expired':
        await this.purgeExpiredKybDocuments();
        break;
      case 'send_email':
        await this.sendEmail(job.data);
        break;
      case 'generate_report':
        await this.generateReport(job.data);
        break;
      default:
        this.logger.warn(`Unknown job type: ${job.type}`);
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
    // Placeholder for email sending
    this.logger.log(`Sending email: ${JSON.stringify(data)}`);
  }

  private async generateReport(data: Record<string, unknown>): Promise<void> {
    // Placeholder for report generation
    this.logger.log(`Generating report: ${JSON.stringify(data)}`);
  }
}
