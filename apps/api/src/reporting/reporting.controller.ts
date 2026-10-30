import {
  Controller,
  Get,
  Query,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../authorization/permission.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantContextService } from '../tenant/tenant-context.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import { ReportingService } from './reporting.service';
import {
  storeIdQuerySchema,
  lowStockThresholdQuerySchema,
} from '../common/validation/schemas';

@Controller('reports')
@UseGuards(AuthGuard, PermissionGuard)
export class ReportingController {
  constructor(
    private readonly reportingService: ReportingService,
    private readonly tenantContext: TenantContextService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Get('sales-summary')
  @RequirePermissions('reports.view')
  @UsePipes(new JoiValidationPipe(storeIdQuerySchema))
  async getSalesSummary(
    @Req() request: RequestWithUser,
    @Query('storeId') storeId?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'analytics');

    // Enforce store scope: user can only request reports for stores they have access to
    const effectiveStoreIds = user.allStoreAccess
      ? undefined
      : user.storeIds;
    if (storeId) {
      this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
      if (!user.allStoreAccess && !user.storeIds.includes(storeId)) {
        throw new UnauthorizedException('Store is outside your assigned scope.');
      }
    }

    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || now.toISOString().split('T')[0];
    return this.reportingService.getSalesSummary(user.tenantId, {
      storeId,
      storeIds: effectiveStoreIds,
      startDate: start,
      endDate: end,
    });
  }

  @Get('inventory')
  @RequirePermissions('reports.view')
  @UsePipes(new JoiValidationPipe(storeIdQuerySchema))
  @UsePipes(new JoiValidationPipe(lowStockThresholdQuerySchema))
  async getInventoryReport(
    @Req() request: RequestWithUser,
    @Query('storeId') storeId?: string,
    @Query('lowStockThreshold') lowStockThreshold?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    if (storeId) this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'inventory');
    return this.reportingService.getInventoryReport(user.tenantId, {
      storeId,
      storeIds: user.allStoreAccess ? undefined : user.storeIds,
      lowStockThreshold: lowStockThreshold ? parseInt(lowStockThreshold, 10) : undefined,
    });
  }

  @Get('store-comparison')
  @RequirePermissions('reports.view')
  async getStoreComparison(
    @Req() request: RequestWithUser,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('storeId') storeId?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'analytics');

    // Enforce store scope
    if (storeId) {
      this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
      if (!user.allStoreAccess && !user.storeIds.includes(storeId)) {
        throw new UnauthorizedException('Store is outside your assigned scope.');
      }
    }

    const effectiveStoreIds = user.allStoreAccess
      ? (storeId ? [storeId] : undefined)
      : (storeId ? [storeId] : user.storeIds);

    const now = new Date();
    const start = startDate || new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || now.toISOString().split('T')[0];
    return this.reportingService.getStoreComparison(
      user.tenantId,
      start,
      end,
      effectiveStoreIds,
    );
  }
}
