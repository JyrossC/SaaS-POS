import { ApiBearerAuth } from '@nestjs/swagger';
import { ApiResponseSchema } from '../common/openapi/response-schema.decorator';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UnauthorizedException,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { AuthGuard, RequestWithUser } from '../auth/auth.guard';
import { RequirePermissions } from '../authorization/permission.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { ApiJoiBody } from '../common/openapi/joi-body.decorator';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import { EntitlementService } from '../subscription/entitlement.service';
import {
  createTenantRoleSchema,
  fiscalJurisdictionSchema,
  tenantFiscalAddonRequestSchema,
  tenantFiscalProfileSchema,
  fiscalSimulationSchema,
  fiscalAddonCheckoutSchema,
  fiscalAddonPaymentSimulationSchema,
  inviteStaffSchema,
  paginationSchema,
  updateTenantRoleSchema,
  updateBusinessSettingsSchema,
} from '../common/validation/schemas';
import {
  CreateTenantRoleRequest,
  InviteStaffRequest,
  UpdateTenantRoleRequest,
  UpdateBusinessSettingsRequest,
} from './tenant.types';
import { TenantService } from './tenant.service';
import {
  businessSettingsResponseSchema,
  tenantFiscalizationResponseSchema,
  fiscalSimulationResponseSchema,
  fiscalAddonSubscriptionsResponseSchema,
  fiscalAddonCheckoutResponseSchema,
  fiscalAddonPaymentSimulationResponseSchema,
  fiscalAddonSubscriptionActionResponseSchema,
} from '../common/openapi/response-schemas';
import { FiscalizationService } from '../platform/fiscalization.service';
import { FiscalAddonBillingService } from '../platform/fiscal-addon-billing.service';
import {
  FiscalJurisdiction,
  TenantFiscalAddonRequestCreate,
  TenantFiscalProfileRequest,
  FiscalSimulationRequest,
  FiscalAddonCheckoutRequest,
  FiscalAddonPaymentSimulationRequest,
} from '../platform/platform.types';

@ApiBearerAuth('bearer')
@Controller('tenant')
@UseGuards(AuthGuard, PermissionGuard)
export class TenantController {
  constructor(
    private readonly tenantService: TenantService,
    private readonly entitlementService: EntitlementService,
    private readonly fiscalizationService: FiscalizationService,
    private readonly fiscalAddonBillingService: FiscalAddonBillingService,
  ) {}

  @Get('me')
  getCurrentTenant(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.tenantService.getCurrentTenantContext(user);
  }

  @Get('settings')
  @RequirePermissions('business_settings.view')
  @ApiResponseSchema(200, businessSettingsResponseSchema)
  getBusinessSettings(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.tenantService.getBusinessSettings(user.tenantId);
  }

  @Patch('settings')
  @RequirePermissions('business_settings.update')
  @ApiJoiBody(updateBusinessSettingsSchema)
  @ApiResponseSchema(200, businessSettingsResponseSchema)
  updateBusinessSettings(
    @Req() request: RequestWithUser,
    @Body(new JoiValidationPipe(updateBusinessSettingsSchema)) body: UpdateBusinessSettingsRequest,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.tenantService.updateBusinessSettings(user, body);
  }

  @Get('fiscalization')
  @RequirePermissions('fiscal_settings.view')
  @ApiResponseSchema(200, tenantFiscalizationResponseSchema)
  getFiscalizationSettings(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalizationService.getTenantConfiguration(user.tenantId);
  }

  @Patch('fiscalization/profiles/:jurisdiction')
  @RequirePermissions('fiscal_settings.update')
  @ApiJoiBody(tenantFiscalProfileSchema)
  updateFiscalProfile(
    @Req() request: RequestWithUser,
    @Param('jurisdiction', new JoiValidationPipe(fiscalJurisdictionSchema)) jurisdiction: FiscalJurisdiction,
    @Body(new JoiValidationPipe(tenantFiscalProfileSchema)) body: TenantFiscalProfileRequest,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalizationService.updateTenantProfile(user, jurisdiction, body);
  }

  @Post('fiscalization/addon-requests')
  @RequirePermissions('fiscal_settings.update')
  @ApiJoiBody(tenantFiscalAddonRequestSchema)
  createFiscalAddonRequest(
    @Req() request: RequestWithUser,
    @Body(new JoiValidationPipe(tenantFiscalAddonRequestSchema)) body: TenantFiscalAddonRequestCreate,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalizationService.createAddonRequest(user, body);
  }

  @Post('fiscalization/simulator/run')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fiscal_settings.view')
  @ApiJoiBody(fiscalSimulationSchema)
  @ApiResponseSchema(200, fiscalSimulationResponseSchema)
  simulateFiscalProvider(
    @Req() request: RequestWithUser,
    @Body(new JoiValidationPipe(fiscalSimulationSchema)) body: FiscalSimulationRequest,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalizationService.simulate(body);
  }

  @Get('fiscalization/addon-subscriptions')
  @RequirePermissions('fiscal_settings.view')
  @ApiResponseSchema(200, fiscalAddonSubscriptionsResponseSchema)
  getFiscalAddonSubscriptions(@Req() request: RequestWithUser) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalAddonBillingService.listTenantSubscriptions(request.user.tenantId);
  }

  @Post('fiscalization/addon-subscriptions/checkout')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fiscal_settings.update')
  @ApiJoiBody(fiscalAddonCheckoutSchema)
  @ApiResponseSchema(200, fiscalAddonCheckoutResponseSchema)
  startFiscalAddonCheckout(
    @Req() request: RequestWithUser,
    @Body(new JoiValidationPipe(fiscalAddonCheckoutSchema)) body: FiscalAddonCheckoutRequest,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalAddonBillingService.startCheckout(request.user, body);
  }

  @Post('fiscalization/addon-subscriptions/:subscriptionId/renew')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fiscal_settings.update')
  @ApiResponseSchema(200, fiscalAddonCheckoutResponseSchema)
  renewFiscalAddon(
    @Req() request: RequestWithUser,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalAddonBillingService.renew(request.user, subscriptionId);
  }

  @Post('fiscalization/addon-subscriptions/:subscriptionId/cancel')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fiscal_settings.update')
  @ApiResponseSchema(200, fiscalAddonSubscriptionActionResponseSchema)
  cancelFiscalAddon(
    @Req() request: RequestWithUser,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalAddonBillingService.cancel(request.user, subscriptionId);
  }

  @Post('fiscalization/addon-subscriptions/:subscriptionId/resume')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fiscal_settings.update')
  @ApiResponseSchema(200, fiscalAddonSubscriptionActionResponseSchema)
  resumeFiscalAddon(
    @Req() request: RequestWithUser,
    @Param('subscriptionId') subscriptionId: string,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalAddonBillingService.resume(request.user, subscriptionId);
  }

  @Post('fiscalization/addon-invoices/:invoiceId/simulate-payment')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('fiscal_settings.update')
  @ApiJoiBody(fiscalAddonPaymentSimulationSchema)
  @ApiResponseSchema(200, fiscalAddonPaymentSimulationResponseSchema)
  simulateFiscalAddonPayment(
    @Req() request: RequestWithUser,
    @Param('invoiceId') invoiceId: string,
    @Body(new JoiValidationPipe(fiscalAddonPaymentSimulationSchema))
    body: FiscalAddonPaymentSimulationRequest,
  ) {
    if (!request.user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.fiscalAddonBillingService.simulatePayment(request.user, invoiceId, body);
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
  @ApiJoiBody(inviteStaffSchema)
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

  @Patch('staff/:membershipId/deactivate')
  @RequirePermissions('staff.deactivate')
  async deactivateStaff(
    @Req() request: RequestWithUser,
    @Param('membershipId') membershipId: string,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.tenantService.deactivateStaff(user, membershipId);
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

  @Get('permissions')
  @RequirePermissions('roles.view')
  async listAssignablePermissions(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'staff');
    return this.tenantService.listAssignablePermissions(user);
  }

  @Post('roles')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('roles.create')
  @ApiJoiBody(createTenantRoleSchema)
  async createRole(
    @Req() request: RequestWithUser,
    @Body(new JoiValidationPipe(createTenantRoleSchema)) body: CreateTenantRoleRequest,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'staff', true);
    return this.tenantService.createRole(user, body);
  }

  @Patch('roles/:roleId')
  @RequirePermissions('roles.update')
  @ApiJoiBody(updateTenantRoleSchema)
  async updateRole(
    @Req() request: RequestWithUser,
    @Param('roleId') roleId: string,
    @Body(new JoiValidationPipe(updateTenantRoleSchema)) body: UpdateTenantRoleRequest,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'staff');
    return this.tenantService.updateRole(user, roleId, body);
  }
}
