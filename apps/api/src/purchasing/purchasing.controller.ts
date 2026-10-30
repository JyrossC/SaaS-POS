import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
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
import {
  paginationSchema,
  supplierIdParamSchema,
  storeIdQuerySchema,
  statusQuerySchema,
  searchQuerySchema,
} from '../common/validation/schemas';
import { CreatePurchaseOrderInput, CreateSupplierInput, PurchasingService, ReceiveGoodsInput, UpdateSupplierInput } from './purchasing.service';

@Controller('purchasing')
@UseGuards(AuthGuard, PermissionGuard)
export class PurchasingController {
  constructor(
    private readonly purchasingService: PurchasingService,
    private readonly tenantContext: TenantContextService,
    private readonly entitlementService: EntitlementService,
  ) {}

  // --- Suppliers ---

  @Post('suppliers')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('purchases.create')
  async createSupplier(
    @Req() request: RequestWithUser,
    @Body() body: CreateSupplierInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing', true);
    return this.purchasingService.createSupplier(user.tenantId, body);
  }

  @Get('suppliers')
  @RequirePermissions('purchases.view')
  @UsePipes(
    new JoiValidationPipe(paginationSchema),
    new JoiValidationPipe(searchQuerySchema),
    new JoiValidationPipe(statusQuerySchema),
  )
  async listSuppliers(
    @Req() request: RequestWithUser,
    @Query('search') search?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing');
    return this.purchasingService.listSuppliers(user.tenantId, {
      search,
      status: status as 'ACTIVE' | 'INACTIVE' | undefined,
      page: parseInt(page || '1', 10),
      pageSize: parseInt(pageSize || '25', 10),
    });
  }

  @Get('suppliers/:supplierId')
  @RequirePermissions('purchases.view')
  @UsePipes(new JoiValidationPipe(supplierIdParamSchema))
  async getSupplier(
    @Req() request: RequestWithUser,
    @Param('supplierId') supplierId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing');
    return this.purchasingService.getSupplier(user.tenantId, supplierId);
  }

  @Post('suppliers/:supplierId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('purchases.create')
  async updateSupplier(
    @Req() request: RequestWithUser,
    @Param('supplierId') supplierId: string,
    @Body() body: UpdateSupplierInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing', true);
    return this.purchasingService.updateSupplier(user.tenantId, supplierId, body);
  }

  // --- Purchase Orders ---

  @Post('purchase-orders')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('purchases.create')
  async createPurchaseOrder(
    @Req() request: RequestWithUser,
    @Body() body: CreatePurchaseOrderInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, body.storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing', true);
    return this.purchasingService.createPurchaseOrder(user.tenantId, user, body);
  }

  @Get('purchase-orders')
  @RequirePermissions('purchases.view')
  @UsePipes(
    new JoiValidationPipe(paginationSchema),
    new JoiValidationPipe(storeIdQuerySchema),
    new JoiValidationPipe(statusQuerySchema),
  )
  async listPurchaseOrders(
    @Req() request: RequestWithUser,
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    if (storeId) this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing');
    return this.purchasingService.listPurchaseOrders(
      user.tenantId,
      storeId,
      status,
      parseInt(page || '1', 10),
      parseInt(pageSize || '25', 10),
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Get('purchase-orders/:orderId')
  @RequirePermissions('purchases.view')
  async getPurchaseOrder(
    @Req() request: RequestWithUser,
    @Param('orderId') orderId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing');
    return this.purchasingService.getPurchaseOrder(user.tenantId, orderId);
  }

  @Post('purchase-orders/:orderId/approve')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('purchases.approve')
  async approvePurchaseOrder(
    @Req() request: RequestWithUser,
    @Param('orderId') orderId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing', true);
    return this.purchasingService.approvePurchaseOrder(user.tenantId, orderId, user);
  }

  // --- Goods Receipts ---

  @Post('goods-receipts')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('purchases.create')
  async receiveGoods(
    @Req() request: RequestWithUser,
    @Body() body: ReceiveGoodsInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, body.storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing', true);
    return this.purchasingService.receiveGoods(user.tenantId, user, body);
  }

  @Get('goods-receipts')
  @RequirePermissions('purchases.view')
  @UsePipes(
    new JoiValidationPipe(paginationSchema),
    new JoiValidationPipe(storeIdQuerySchema),
  )
  async listGoodsReceipts(
    @Req() request: RequestWithUser,
    @Query('storeId') storeId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    if (storeId) this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'purchasing');
    return this.purchasingService.listGoodsReceipts(
      user.tenantId,
      storeId,
      parseInt(page || '1', 10),
      parseInt(pageSize || '25', 10),
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }
}
