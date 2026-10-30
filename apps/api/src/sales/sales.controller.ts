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
  saleIdParamSchema,
} from '../common/validation/schemas';
import { CreateSaleInput, SalesService } from './sales.service';

@Controller('sales')
@UseGuards(AuthGuard, PermissionGuard)
export class SalesController {
  constructor(
    private readonly salesService: SalesService,
    private readonly tenantContext: TenantContextService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('sales.create')
  async createSale(
    @Req() request: RequestWithUser,
    @Body() body: CreateSaleInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, body.storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pos', true);
    return this.salesService.createSale(user.tenantId, user, body);
  }

  @Get()
  @RequirePermissions('sales.view')
  @UsePipes(new JoiValidationPipe(paginationSchema))
  async listSales(
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
    this.entitlementService.assertModuleAccess(user, context, 'pos');
    return this.salesService.listSales(
      user.tenantId,
      storeId,
      status,
      parseInt(page || '1', 10),
      parseInt(pageSize || '25', 10),
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Get(':saleId')
  @RequirePermissions('sales.view')
  @UsePipes(new JoiValidationPipe(saleIdParamSchema))
  async getSale(
    @Req() request: RequestWithUser,
    @Param('saleId') saleId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pos');
    return this.salesService.getSale(
      user.tenantId,
      saleId,
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Post(':saleId/void')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('sales.void')
  @UsePipes(new JoiValidationPipe(saleIdParamSchema))
  async voidSale(
    @Req() request: RequestWithUser,
    @Param('saleId') saleId: string,
    @Body('reason') reason?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pos', true);
    return this.salesService.voidSale(user.tenantId, saleId, user, reason || 'No reason provided');
  }
}
