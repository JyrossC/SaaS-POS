import { Module, forwardRef } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { SubscriptionModule } from '../subscription/subscription.module';
import { TenantContextService } from './tenant-context.service';
import { TenantController } from './tenant.controller';
import { TenantService } from './tenant.service';

@Module({
  imports: [AuthModule, forwardRef(() => SubscriptionModule)],
  controllers: [TenantController],
  providers: [TenantContextService, TenantService],
  exports: [TenantContextService, TenantService],
})
export class TenantModule {}