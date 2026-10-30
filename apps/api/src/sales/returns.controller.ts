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
} from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../authorization/permission.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateRefundInput, ReturnsService } from './returns.service';

@Controller('returns')
@UseGuards(AuthGuard, PermissionGuard)
export class ReturnsController {
  constructor(
    private readonly returnsService: ReturnsService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('sales.refund')
  async createRefund(
    @Req() request: RequestWithUser,
    @Body() body: CreateRefundInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId);
    return this.returnsService.createRefund(user.tenantId, user, body);
  }

  @Get()
  @RequirePermissions('sales.view')
  async listRefunds(
    @Req() request: RequestWithUser,
    @Query('saleId') saleId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.returnsService.listRefunds(
      user.tenantId,
      saleId,
      parseInt(page || '1', 10),
      parseInt(pageSize || '25', 10),
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Get(':refundId')
  @RequirePermissions('sales.view')
  async getRefund(
    @Req() request: RequestWithUser,
    @Param('refundId') refundId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.returnsService.getRefund(
      user.tenantId,
      refundId,
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }
}
