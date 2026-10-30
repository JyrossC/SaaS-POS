import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { PermissionGuard } from './authorization/permission.guard';
import { InventoryModule } from './inventory/inventory.module';
import { ProductsModule } from './products/products.module';
import { PlatformModule } from './platform/platform.module';
import { PrismaModule } from './database/prisma.module';
import { SubscriptionModule } from './subscription/subscription.module';
import { TenantModule } from './tenant/tenant.module';
import { StoresModule } from './stores/stores.module';
import { PurchasingModule } from './purchasing/purchasing.module';
import { SalesModule } from './sales/sales.module';
import { PharmacyModule } from './pharmacy/pharmacy.module';
import { ReportingModule } from './reporting/reporting.module';
import { AIModule } from './ai/ai.module';
import { JobsModule } from './jobs/jobs.module';
import { LoggingModule } from './logging/logging.module';
import { HealthController } from './health/health.controller';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';

@Module({
  imports: [
    PrismaModule,
    AuthModule,
    TenantModule,
    SubscriptionModule,
    ProductsModule,
    InventoryModule,
    StoresModule,
    PurchasingModule,
    SalesModule,
    PharmacyModule,
    ReportingModule,
    AIModule,
    JobsModule,
    PlatformModule,
    LoggingModule,
  ],
  controllers: [AppController, HealthController],
  providers: [
    AppService,
    PermissionGuard,
    {
      provide: APP_FILTER,
      useClass: GlobalExceptionFilter,
    },
  ],
})
export class AppModule {}
