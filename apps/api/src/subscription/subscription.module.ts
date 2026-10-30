import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantModule } from '../tenant/tenant.module';
import { EntitlementService } from './entitlement.service';
import { SubscriptionController } from './subscription.controller';
import { SubscriptionService } from './subscription.service';

@Module({
  imports: [AuthModule, forwardRef(() => TenantModule)],
  controllers: [SubscriptionController],
  providers: [EntitlementService, SubscriptionService, PermissionGuard],
  exports: [EntitlementService, SubscriptionService],
})
export class SubscriptionModule {}
