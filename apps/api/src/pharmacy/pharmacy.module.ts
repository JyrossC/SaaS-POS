import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../authorization/permission.guard';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenantModule } from '../tenant/tenant.module';
import { PharmacyController } from './pharmacy.controller';
import { PharmacyService } from './pharmacy.service';

@Module({
  imports: [AuthModule, SubscriptionModule, TenantModule],
  controllers: [PharmacyController],
  providers: [PharmacyService, PermissionGuard],
  exports: [PharmacyService],
})
export class PharmacyModule {}
