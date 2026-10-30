import { Module } from '@nestjs/common';
import { PrismaModule } from '../database/prisma.module';
import { JobProcessor } from './job-processor';

@Module({
  imports: [PrismaModule],
  providers: [JobProcessor],
  exports: [JobProcessor],
})
export class JobsModule {}
