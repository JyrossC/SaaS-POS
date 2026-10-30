import {
  Body,
  Controller,
  Get,
  Post,
  Param,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../authorization/permission.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { JobQueueService, JobProcessor, EnqueueJobInput } from './job-processor';

@Controller('jobs')
@UseGuards(AuthGuard, PermissionGuard)
export class JobsController {
  constructor(
    private readonly queue: JobQueueService,
    private readonly processor: JobProcessor,
  ) {}

  @Get('stats')
  @RequirePermissions('jobs.view')
  async getStats(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.queue.getJobStats();
  }

  @Get('failed')
  @RequirePermissions('jobs.view')
  async getFailedJobs(
    @Req() request: RequestWithUser,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.queue.getFailedJobs();
  }

  @Post('failed/:jobId/retry')
  @RequirePermissions('jobs.manage')
  async retryFailedJob(
    @Req() request: RequestWithUser,
    @Param('jobId') jobId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.queue.retryFailedJob(jobId);
  }

  @Post('process-due')
  @RequirePermissions('jobs.manage')
  async processDueJobs(
    @Req() request: RequestWithUser,
    @Body() body?: { limit?: number },
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.processor.processDueJobs(body?.limit ?? 50);
  }

  @Post('enqueue')
  @RequirePermissions('jobs.manage')
  async enqueueJob(
    @Req() request: RequestWithUser,
    @Body() body: EnqueueJobInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.queue.enqueue({
      type: body.type,
      data: body.data,
      tenantId: body.tenantId ?? user.tenantId,
      maxAttempts: body.maxAttempts,
      runAt: body.runAt ? new Date(body.runAt) : undefined,
    });
  }
}
