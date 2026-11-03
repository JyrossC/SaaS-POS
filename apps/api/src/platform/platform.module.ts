import { Module } from '@nestjs/common';
import { EmailModule } from '../email/email.module';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformController } from './platform.controller';
import { PlatformPaymentProviderService } from './platform-payment-provider.service';
import { PlatformManagementService } from './platform-management.service';
import { PlatformService } from './platform.service';
import { TenantKybService } from './tenant-kyb.service';
import { FiscalizationService } from './fiscalization.service';
import { FiscalSimulatorService } from './fiscal-simulator.service';
import { FiscalAddonBillingService } from './fiscal-addon-billing.service';

@Module({
  imports: [EmailModule],
  controllers: [PlatformController],
  providers: [
    PlatformService,
    PlatformManagementService,
    PlatformAuthService,
    PlatformPaymentProviderService,
    PlatformAuthGuard,
    TenantKybService,
    FiscalizationService,
    FiscalSimulatorService,
    FiscalAddonBillingService,
  ],
  exports: [
    PlatformAuthService,
    PlatformAuthGuard,
    PlatformPaymentProviderService,
    TenantKybService,
    FiscalizationService,
    FiscalSimulatorService,
    FiscalAddonBillingService,
  ],
})
export class PlatformModule {}