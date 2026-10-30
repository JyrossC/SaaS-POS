import {
  Body,
  BadRequestException,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../authorization/permission.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  adjustStockSchema,
  inventoryStoreIdSchema,
} from '../common/validation/schemas';
import { TenantContextService } from '../tenant/tenant-context.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { AdjustStockInput, InventoryService } from './inventory.service';

@Controller('stores/:storeId/inventory')
@UseGuards(AuthGuard, PermissionGuard)
export class InventoryController {
  constructor(
    private readonly inventoryService: InventoryService,
    private readonly tenantContext: TenantContextService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Get()
  @RequirePermissions('inventory.view')
  async list(
    @Req() request: RequestWithUser,
    @Param('storeId', new JoiValidationPipe(inventoryStoreIdSchema)) storeId: string,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'inventory');
    return this.inventoryService.listStoreInventory(user.tenantId, storeId);
  }

  @Post('stock-adjustments')
  @RequirePermissions('inventory.adjust')
  @UsePipes(new JoiValidationPipe(adjustStockSchema))
  async adjust(
    @Req() request: RequestWithUser,
    @Param('storeId', new JoiValidationPipe(inventoryStoreIdSchema)) storeId: string,
    @Headers('idempotency-key') idempotencyKey: string | undefined,
    @Body() body: AdjustStockInput,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    if (!idempotencyKey || idempotencyKey.trim().length === 0 || idempotencyKey.length > 128) {
      throw new BadRequestException('A valid Idempotency-Key header is required.');
    }
    this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'inventory');
    return this.inventoryService.adjustStock(
      user.tenantId,
      storeId,
      user,
      body,
      idempotencyKey,
    );
  }
}
