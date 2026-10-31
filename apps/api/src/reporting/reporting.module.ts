import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../authorization/permission.guard';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenantModule } from '../tenant/tenant.module';
import { ReportingController } from './reporting.controller';
import { ReportingService } from './reporting.service';

@Module({
  imports: [AuthModule, SubscriptionModule, TenantModule],
  controllers: [ReportingController],
  providers: [ReportingService, PermissionGuard],
  exports: [ReportingService],
})
export class ReportingModule {}
