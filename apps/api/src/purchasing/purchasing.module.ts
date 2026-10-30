import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../authorization/permission.guard';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenantModule } from '../tenant/tenant.module';
import { PurchasingController } from './purchasing.controller';
import { PurchasingService } from './purchasing.service';

@Module({
  imports: [AuthModule, SubscriptionModule, TenantModule],
  controllers: [PurchasingController],
  providers: [PurchasingService, PermissionGuard],
  exports: [PurchasingService],
})
export class PurchasingModule {}
