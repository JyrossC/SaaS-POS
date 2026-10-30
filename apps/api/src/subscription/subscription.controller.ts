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
import { paginationSchema, invoiceIdParamSchema, recordPaymentBodySchema } from '../common/validation/schemas';
import { ChangePlanInput, RenewSubscriptionInput, SubscriptionService } from './subscription.service';

@Controller('subscription')
@UseGuards(AuthGuard, PermissionGuard)
export class SubscriptionController {
  constructor(
    private readonly subscriptionService: SubscriptionService,
    private readonly tenantContext: TenantContextService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Get()
  @RequirePermissions('subscription.view')
  async getDetails(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'subscription');
    return this.subscriptionService.getSubscriptionDetails(user.tenantId);
  }

  @Post('change-plan')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('subscription.manage')
  async changePlan(
    @Req() request: RequestWithUser,
    @Body() body: ChangePlanInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'subscription', true);
    return this.subscriptionService.changePlan(user.tenantId, user, body);
  }

  @Post('renew')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('subscription.manage')
  async renew(
    @Req() request: RequestWithUser,
    @Body() body: RenewSubscriptionInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'subscription', true);
    return this.subscriptionService.renewSubscription(user.tenantId, user, body);
  }

  @Post('suspend')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('subscription.manage')
  async suspend(
    @Req() request: RequestWithUser,
    @Body('reason') reason?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'subscription', true);
    return this.subscriptionService.suspendSubscription(user.tenantId, user, reason || 'No reason provided');
  }

  @Post('reactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('subscription.manage')
  async reactivate(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'subscription', true);
    return this.subscriptionService.reactivateSubscription(user.tenantId, user);
  }

  @Get('invoices')
  @RequirePermissions('subscription.view')
  @UsePipes(new JoiValidationPipe(paginationSchema))
  async getInvoices(
    @Req() request: RequestWithUser,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'subscription');
    return this.subscriptionService.getInvoices(
      user.tenantId,
      parseInt(page || '1', 10),
      parseInt(pageSize || '25', 10),
    );
  }

  @Post('invoices/:invoiceId/pay')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('subscription.manage')
  @UsePipes(new JoiValidationPipe(invoiceIdParamSchema))
  @UsePipes(new JoiValidationPipe(recordPaymentBodySchema))
  async recordPayment(
    @Req() request: RequestWithUser,
    @Param('invoiceId') invoiceId: string,
    @Body() body: { amount: string; providerReference?: string | null },
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'subscription', true);
    return this.subscriptionService.recordPayment(
      user.tenantId,
      invoiceId,
      user,
      body.amount,
      body.providerReference,
    );
  }
}
