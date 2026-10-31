import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PermissionGuard } from '../authorization/permission.guard';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenantModule } from '../tenant/tenant.module';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { CashSessionController } from './cash-session.controller';
import { CashSessionService } from './cash-session.service';
import { ReturnsController } from './returns.controller';
import { ReturnsService } from './returns.service';

import { PharmacyModule } from '../pharmacy/pharmacy.module';
import { CampaignModule } from '../campaigns/campaign.module';

@Module({
  imports: [AuthModule, SubscriptionModule, TenantModule, PharmacyModule, CampaignModule],
  controllers: [SalesController, CashSessionController, ReturnsController],
  providers: [SalesService, CashSessionService, ReturnsService, PermissionGuard],
  exports: [SalesService, CashSessionService, ReturnsService],
})
export class SalesModule {}
