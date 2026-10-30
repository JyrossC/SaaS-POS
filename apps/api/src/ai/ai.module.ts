import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantModule } from '../tenant/tenant.module';
import { ReportingModule } from '../reporting/reporting.module';
import { AIController } from './ai.controller';
import { AIService } from './ai.service';

@Module({
  imports: [AuthModule, TenantModule, ReportingModule],
  controllers: [AIController],
  providers: [AIService, PermissionGuard],
  exports: [AIService],
})
export class AIModule {}
