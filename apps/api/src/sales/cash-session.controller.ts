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
import { CashSessionService, CloseCashSessionInput, OpenCashSessionInput } from './cash-session.service';

@Controller('cash-sessions')
@UseGuards(AuthGuard, PermissionGuard)
export class CashSessionController {
  constructor(
    private readonly cashSessionService: CashSessionService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('open')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('sales.create')
  async open(
    @Req() request: RequestWithUser,
    @Body() body: OpenCashSessionInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, body.storeId);
    return this.cashSessionService.openSession(user.tenantId, user, body);
  }

  @Post(':sessionId/close')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('sales.create')
  async close(
    @Req() request: RequestWithUser,
    @Param('sessionId') sessionId: string,
    @Body() body: CloseCashSessionInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    await this.cashSessionService.getSession(
      user.tenantId,
      sessionId,
      user.allStoreAccess ? undefined : user.storeIds,
    );
    return this.cashSessionService.closeSession(user.tenantId, sessionId, user, body);
  }

  @Get('current/:storeId')
  @RequirePermissions('sales.view')
  async getCurrent(
    @Req() request: RequestWithUser,
    @Param('storeId') storeId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    return this.cashSessionService.getCurrentSession(
      user.tenantId,
      storeId,
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Get(':sessionId')
  @RequirePermissions('sales.view')
  async getById(
    @Req() request: RequestWithUser,
    @Param('sessionId') sessionId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.cashSessionService.getSession(
      user.tenantId,
      sessionId,
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Get()
  @RequirePermissions('sales.view')
  async list(
    @Req() request: RequestWithUser,
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    if (storeId) this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    return this.cashSessionService.listSessions(
      user.tenantId,
      storeId,
      status,
      parseInt(page || '1', 10),
      parseInt(pageSize || '25', 10),
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }
}
