import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../authorization/permission.guard';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenantModule } from '../tenant/tenant.module';
import { InventoryController } from './inventory.controller';
import { InventoryService } from './inventory.service';

@Module({
  imports: [AuthModule, SubscriptionModule, TenantModule],
  controllers: [InventoryController],
  providers: [InventoryService, PermissionGuard],
})
export class InventoryModule {}
