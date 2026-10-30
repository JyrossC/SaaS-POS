import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../authorization/permission.guard';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenantModule } from '../tenant/tenant.module';
import { StoresController } from './stores.controller';
import { StoresService } from './stores.service';

@Module({
  imports: [AuthModule, SubscriptionModule, TenantModule],
  controllers: [StoresController],
  providers: [StoresService, PermissionGuard],
  exports: [StoresService],
})
export class StoresModule {}
