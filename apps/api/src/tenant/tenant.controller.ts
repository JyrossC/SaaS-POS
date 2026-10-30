import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard, RequestWithUser } from '../auth/auth.guard';
import { RequirePermissions } from '../authorization/permission.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import { EntitlementService } from '../subscription/entitlement.service';
import {
  inviteStaffSchema,
  paginationSchema,
} from '../common/validation/schemas';
import { InviteStaffRequest } from './tenant.types';
import { TenantService } from './tenant.service';

@Controller('tenant')
@UseGuards(AuthGuard, PermissionGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Get('me')
  getCurrentTenant(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.tenantService.getCurrentTenantContext(user);
  }

  @Get('staff')
  @RequirePermissions('staff.view')
  @UsePipes(new JoiValidationPipe(paginationSchema))
  async listStaff(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'staff');
    return this.tenantService.listStaff(user.tenantId);
  }

  @Post('staff/invitations')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('staff.invite')
  async inviteStaff(
    @Req() request: RequestWithUser,
    @Body(new JoiValidationPipe(inviteStaffSchema)) body: InviteStaffRequest,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'staff', true);
    return this.tenantService.inviteStaff(user, body);
  }

  @Get('roles')
  @RequirePermissions('roles.view')
  async listRoles(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'staff');
    return this.tenantService.listRoles(user.tenantId);
  }
}
