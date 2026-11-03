import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { PlatformModule } from '../platform/platform.module';
import { TenantContextService } from './tenant-context.service';
import { TenantController } from './tenant.controller';
import { TenantOnboardingGuard } from './tenant-onboarding.guard';
import { TenantOnboardingController } from './tenant-onboarding.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuthModule, PlatformModule, forwardRef(() => SubscriptionModule)],
  controllers: [TenantController, TenantOnboardingController],
  providers: [TenantContextService, TenantOnboardingGuard, TenantService],
  exports: [TenantContextService, TenantService],
})
export class TenantModule {}