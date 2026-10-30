import { Module } from '@nestjs/common';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformController } from './platform.controller';
import { PlatformPaymentProviderService } from './platform-payment-provider.service';
import { PlatformService } from './platform.service';
import { TenantKybService } from './tenant-kyb.service';

@Module({
  controllers: [PlatformController],
  providers: [
    PlatformService,
    PlatformAuthService,
    PlatformPaymentProviderService,
    PlatformAuthGuard,
    TenantKybService,
  ],
  exports: [PlatformAuthService, PlatformAuthGuard, PlatformPaymentProviderService],
})
export class PlatformModule {}