import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { JobProcessor, JobQueueService } from './job-processor';
import { JobsController } from './jobs.controller';

@Module({
  imports: [PrismaModule],
  providers: [JobProcessor, JobQueueService],
  controllers: [JobsController],
  exports: [JobProcessor, JobQueueService],
})
export class JobsModule {}
