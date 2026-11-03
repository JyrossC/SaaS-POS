import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  Put,
  Delete,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiQuery } from '@nestjs/swagger';
import type { Response } from 'express';
import { ApiJoiBody, joiSchemaToOpenApiSchema } from '../common/openapi/joi-body.decorator';
import { ApiResponseSchema } from '../common/openapi/response-schema.decorator';
import {
  approvedTenantResponseSchema,
  installationResponseSchema,
  installationStatusResponseSchema,
  logoutResponseSchema,
  mfaSetupResponseSchema,
  platformAdminInvitationAcceptanceResponseSchema,
  platformAdminInvitationResponseSchema,
  platformAdminListResponseSchema,
  platformAdminStatusResponseSchema,
  platformAdminSessionResponseSchema,
  platformLoginResponseSchema,
  platformPlanAvailabilityResponseSchema,
  platformPlanCreateResponseSchema,
  platformPlanListResponseSchema,
  platformPlanVersionResponseSchema,
  platformSupportAccessGrantResponseSchema,
  platformSupportAccessListResponseSchema,
  platformSupportAccessRevokeResponseSchema,
  platformSupportProductsResponseSchema,
  platformSupportSalesSummaryResponseSchema,
  platformSupportStoresResponseSchema,
  platformSupportTenantResponseSchema,
  platformTenantPlanResponseSchema,
  platformTenantStatusResponseSchema,
  platformFiscalizationResponseSchema,
  fiscalProviderConfigurationResponseSchema,
  fiscalAddonRequestUpdateResponseSchema,
  fiscalAddonOfferResponseSchema,
  platformStatsResponseSchema,
  platformTenantListResponseSchema,
  rejectedTenantResponseSchema,
} from '../common/openapi/response-schemas';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  installationSchema,
  kybDocumentReviewSchema,
  kybDocumentUploadSchema,
  paymentProviderConfigSchema,
  paymentProviderNameSchema,
  paymentWebhookBodySchema,
  platformAdminInvitationAcceptanceSchema,
  platformAdminInvitationSchema,
  platformAdminStatusSchema,
  platformPlanAvailabilitySchema,
  platformPlanCreateSchema,
  platformPlanVersionCreateSchema,
  platformLoginSchema,
  platformMfaConfirmationSchema,
  platformSetupTokenSchema,
  platformTenantListSchema,
  platformTenantPlanAssignmentSchema,
  platformTenantStatusSchema,
  platformSupportAccessSchema,
  fiscalJurisdictionSchema,
  fiscalProviderConfigurationSchema,
  fiscalAddonOfferSchema,
  fiscalAddonRequestUpdateSchema,
  productIdSchema,
  tenantRejectionSchema,
} from '../common/validation/schemas';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformPaymentProviderService } from './platform-payment-provider.service';
import { PlatformManagementService } from './platform-management.service';
import { PlatformService } from './platform.service';
import { TenantKybService, UploadedKybFile } from './tenant-kyb.service';
import { FiscalizationService } from './fiscalization.service';
import {
  InstallationRequest,
  KybDocumentReviewRequest,
  KybDocumentUploadRequest,
  PaymentProviderName,
  PlatformLoginRequest,
  PlatformPaymentProviderConfig,
  FiscalJurisdiction,
  FiscalProviderConfigurationRequest,
  FiscalAddonOfferRequest,
  FiscalAddonRequestUpdate,
  PlatformAdminInvitationAcceptanceRequest,
  PlatformAdminInvitationRequest,
  PlatformPlanCreateRequest,
  PlatformPlanVersionRequest,
  PlatformSupportAccessRequest,
  RequestWithPlatformAdmin,
  PlatformTenantListQuery,
  TenantRejectionRequest,
} from './platform.types';

@Controller()
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly platformAuthService: PlatformAuthService,
    private readonly paymentProviderService: PlatformPaymentProviderService,
    private readonly tenantKybService: TenantKybService,
    private readonly managementService: PlatformManagementService,
    private readonly fiscalizationService: FiscalizationService,
  ) {}

  @Get('installation/status')
  @ApiResponseSchema(200, installationStatusResponseSchema)
  getInstallationStatus() {
    return this.platformService.getInstallationStatus();
  }

  @Post('installation/initialize')
  @ApiJoiBody(installationSchema)
  @ApiResponseSchema(201, installationResponseSchema)
  @UsePipes(new JoiValidationPipe(installationSchema))
  initialize(
    @Body() body: InstallationRequest,
    @Headers('x-installation-secret') installationSecret?: string,
  ) {
    return this.platformService.initialize(body, installationSecret);
  }

  @Post('platform/auth/login')
  @HttpCode(200)
  @ApiJoiBody(platformLoginSchema)
  @ApiResponseSchema(200, platformLoginResponseSchema)
  @UsePipes(new JoiValidationPipe(platformLoginSchema))
  async login(
    @Body() body: PlatformLoginRequest,
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.platformAuthService.login(body);
    if ('refreshToken' in result) {
      this.setPlatformRefreshCookie(response, result.refreshToken);
      return {
        accessToken: result.accessToken,
        platformAdmin: result.platformAdmin,
        ...(result.recoveryCodes ? { recoveryCodes: result.recoveryCodes } : {}),
      };
    }
    return result;
  }

  @Post('platform/auth/mfa/setup')
  @HttpCode(200)
  @ApiJoiBody(platformSetupTokenSchema)
  @ApiResponseSchema(200, mfaSetupResponseSchema)
  @UsePipes(new JoiValidationPipe(platformSetupTokenSchema))
  setupPlatformMfa(@Body() body: { setupToken: string }) {
    return this.platformAuthService.setupMfa(body.setupToken);
  }

  @Post('platform/auth/mfa/confirm')
  @HttpCode(200)
  @ApiJoiBody(platformMfaConfirmationSchema)
  @ApiResponseSchema(200, platformAdminSessionResponseSchema)
  @UsePipes(new JoiValidationPipe(platformMfaConfirmationSchema))
  async confirmPlatformMfa(
    @Body() body: { setupToken: string; code: string },
    @Res({ passthrough: true }) response: Response,
  ) {
    const result = await this.platformAuthService.confirmMfaSetup(body.setupToken, body.code);
    this.setPlatformRefreshCookie(response, result.refreshToken);
    return {
      accessToken: result.accessToken,
      platformAdmin: result.platformAdmin,
      recoveryCodes: result.recoveryCodes,
    };
  }

  @Post('platform/auth/invitation/accept')
  @HttpCode(200)
  @ApiResponseSchema(200, platformAdminInvitationAcceptanceResponseSchema)
  @ApiJoiBody(platformAdminInvitationAcceptanceSchema)
  @UsePipes(new JoiValidationPipe(platformAdminInvitationAcceptanceSchema))
  acceptPlatformAdminInvitation(@Body() body: PlatformAdminInvitationAcceptanceRequest) {
    return this.managementService.acceptAdminInvitation(body);
  }

  @Post('platform/auth/refresh')
  @HttpCode(200)
  @ApiResponseSchema(200, platformAdminSessionResponseSchema)
  async refreshPlatformSession(
    @Req() request: RequestWithPlatformAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    this.assertTrustedOrigin(request.headers.origin);
    const refreshToken = this.readCookie(request.headers.cookie, 'spos_platform_refresh');
    if (!refreshToken) throw new UnauthorizedException('Refresh session is invalid or expired.');
    const result = await this.platformAuthService.refreshSession(refreshToken);
    this.setPlatformRefreshCookie(response, result.refreshToken);
    return { accessToken: result.accessToken, platformAdmin: result.platformAdmin };
  }

  @Post('platform/auth/logout')
  @HttpCode(200)
  @ApiBearerAuth('platformBearer')
  @ApiResponseSchema(200, logoutResponseSchema)
  @UseGuards(PlatformAuthGuard)
  async logoutPlatformSession(
    @Req() request: RequestWithPlatformAdmin,
    @Res({ passthrough: true }) response: Response,
  ) {
    if (!request.platformAdmin || !request.authSessionId) {
      throw new UnauthorizedException('Authenticated platform administrator context is required.');
    }
    await this.platformAuthService.revokeSession(request.authSessionId, request.platformAdmin.id);
    this.clearPlatformRefreshCookie(response);
    return { loggedOut: true };
  }

  @Get('platform/me')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  getCurrentPlatformAdmin(@Req() request: RequestWithPlatformAdmin) {
    return request.platformAdmin;
  }

  @Get('platform/admins')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformAdminListResponseSchema)
  listPlatformAdmins() {
    return this.managementService.listAdmins();
  }

  @Post('platform/admins/invitations')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(201, platformAdminInvitationResponseSchema)
  @ApiJoiBody(platformAdminInvitationSchema)
  @UsePipes(new JoiValidationPipe(platformAdminInvitationSchema))
  invitePlatformAdmin(
    @Body() body: PlatformAdminInvitationRequest,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.inviteAdmin(body, request.platformAdmin!.id);
  }

  @Patch('platform/admins/:adminId/status')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformAdminStatusResponseSchema)
  @ApiJoiBody(platformAdminStatusSchema)
  updatePlatformAdminStatus(
    @Param('adminId', new JoiValidationPipe(productIdSchema)) adminId: string,
    @Body(new JoiValidationPipe(platformAdminStatusSchema)) body: { status: 'ACTIVE' | 'DISABLED' },
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.updateAdminStatus(
      adminId,
      body.status,
      request.platformAdmin!.id,
    );
  }

  @Get('platform/plans')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformPlanListResponseSchema)
  listPlatformPlans() {
    return this.managementService.listPlans();
  }

  @Post('platform/plans')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(201, platformPlanCreateResponseSchema)
  @ApiJoiBody(platformPlanCreateSchema)
  @UsePipes(new JoiValidationPipe(platformPlanCreateSchema))
  createPlatformPlan(
    @Body() body: PlatformPlanCreateRequest,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.createPlan(body, request.platformAdmin!.id);
  }

  @Post('platform/plans/:planId/versions')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(201, platformPlanVersionResponseSchema)
  @ApiJoiBody(platformPlanVersionCreateSchema)
  createPlatformPlanVersion(
    @Param('planId', new JoiValidationPipe(productIdSchema)) planId: string,
    @Body(new JoiValidationPipe(platformPlanVersionCreateSchema)) body: PlatformPlanVersionRequest,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.createPlanVersion(planId, body, request.platformAdmin!.id);
  }

  @Patch('platform/plans/:planId/availability')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformPlanAvailabilityResponseSchema)
  @ApiJoiBody(platformPlanAvailabilitySchema)
  updatePlatformPlanAvailability(
    @Param('planId', new JoiValidationPipe(productIdSchema)) planId: string,
    @Body(new JoiValidationPipe(platformPlanAvailabilitySchema)) body: { isAvailable: boolean },
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.updatePlanAvailability(
      planId,
      body.isAvailable,
      request.platformAdmin!.id,
    );
  }

  @Put('platform/tenants/:tenantId/plan')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformTenantPlanResponseSchema)
  @ApiJoiBody(platformTenantPlanAssignmentSchema)
  assignTenantPlan(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
    @Body(new JoiValidationPipe(platformTenantPlanAssignmentSchema)) body: { planVersionId: string },
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.assignTenantPlan(
      tenantId,
      body.planVersionId,
      request.platformAdmin!.id,
    );
  }

  @Patch('platform/tenants/:tenantId/status')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformTenantStatusResponseSchema)
  @ApiJoiBody(platformTenantStatusSchema)
  updatePlatformTenantStatus(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
    @Body(new JoiValidationPipe(platformTenantStatusSchema)) body: { status: 'ACTIVE' | 'SUSPENDED' },
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.updateTenantStatus(
      tenantId,
      body.status,
      request.platformAdmin!.id,
    );
  }

  @Get('platform/support-access')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformSupportAccessListResponseSchema)
  listPlatformSupportAccess(@Req() request: RequestWithPlatformAdmin) {
    return this.managementService.listSupportAccess(request.platformAdmin!.id);
  }

  @Post('platform/support-access')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(201, platformSupportAccessGrantResponseSchema)
  @ApiJoiBody(platformSupportAccessSchema)
  @UsePipes(new JoiValidationPipe(platformSupportAccessSchema))
  createPlatformSupportAccess(
    @Body() body: PlatformSupportAccessRequest,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.createSupportAccess(body, request.platformAdmin!.id);
  }

  @Delete('platform/support-access/:accessId')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformSupportAccessRevokeResponseSchema)
  revokePlatformSupportAccess(
    @Param('accessId', new JoiValidationPipe(productIdSchema)) accessId: string,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.revokeSupportAccess(accessId, request.platformAdmin!.id);
  }

  @Get('platform/support-access/:accessId/tenant')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformSupportTenantResponseSchema)
  getSupportTenant(
    @Param('accessId', new JoiValidationPipe(productIdSchema)) accessId: string,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.getSupportTenant(accessId, request.platformAdmin!.id);
  }

  @Get('platform/support-access/:accessId/stores')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformSupportStoresResponseSchema)
  getSupportStores(
    @Param('accessId', new JoiValidationPipe(productIdSchema)) accessId: string,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.getSupportStores(accessId, request.platformAdmin!.id);
  }

  @Get('platform/support-access/:accessId/products')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformSupportProductsResponseSchema)
  getSupportProducts(
    @Param('accessId', new JoiValidationPipe(productIdSchema)) accessId: string,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.getSupportProducts(accessId, request.platformAdmin!.id);
  }

  @Get('platform/support-access/:accessId/sales-summary')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformSupportSalesSummaryResponseSchema)
  getSupportSalesSummary(
    @Param('accessId', new JoiValidationPipe(productIdSchema)) accessId: string,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.managementService.getSupportSalesSummary(accessId, request.platformAdmin!.id);
  }

  @Get('platform/tenants')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiQuery({ name: 'search', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, enum: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED'] })
  @ApiQuery({ name: 'page', required: false, type: Number, minimum: 1 })
  @ApiQuery({ name: 'pageSize', required: false, type: Number, minimum: 1, maximum: 100 })
  @ApiResponseSchema(200, platformTenantListResponseSchema)
  @UsePipes(new JoiValidationPipe(platformTenantListSchema))
  listTenants(@Query() query: PlatformTenantListQuery) {
    return this.platformService.listTenants(query);
  }

  @Post('platform/tenants/:tenantId/kyb-documents')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    required: true,
    schema: {
      ...joiSchemaToOpenApiSchema(kybDocumentUploadSchema),
      required: ['documentName', 'document'],
      properties: {
        documentName: { type: 'string', minLength: 1, maxLength: 120 },
        document: { type: 'string', format: 'binary' },
      },
    },
  })
  uploadTenantKybDocument(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
    @Body(new JoiValidationPipe(kybDocumentUploadSchema)) body: KybDocumentUploadRequest,
    @UploadedFile() file: UploadedKybFile,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.tenantKybService.upload(
      tenantId,
      request.platformAdmin!.id,
      body.documentName,
      file,
    );
  }

  @Get('platform/tenants/:tenantId/kyb-documents')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  listTenantKybDocuments(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
  ) {
    return this.tenantKybService.list(tenantId);
  }

  @Get('platform/tenants/:tenantId/kyb-documents/:documentId/content')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  async downloadTenantKybDocument(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
    @Param('documentId', new JoiValidationPipe(productIdSchema)) documentId: string,
    @Req() request: RequestWithPlatformAdmin,
    @Res() response: Response,
  ): Promise<void> {
    const document = await this.tenantKybService.download(
      tenantId,
      documentId,
      request.platformAdmin!.id,
    );
    response
      .set({
        'Content-Type': document.mimeType,
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.filename)}`,
        'Cache-Control': 'no-store',
        'X-Content-Type-Options': 'nosniff',
      })
      .send(document.content);
  }

  @Patch('platform/tenants/:tenantId/kyb-documents/:documentId/review')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiJoiBody(kybDocumentReviewSchema)
  reviewTenantKybDocument(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
    @Param('documentId', new JoiValidationPipe(productIdSchema)) documentId: string,
    @Body(new JoiValidationPipe(kybDocumentReviewSchema)) body: KybDocumentReviewRequest,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.tenantKybService.review(
      tenantId,
      documentId,
      request.platformAdmin!.id,
      body.status,
      body.note,
    );
  }

  @Post('platform/tenants/:tenantId/approve')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(201, approvedTenantResponseSchema)
  async approveTenant(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
    @Req() request: RequestWithPlatformAdmin,
  ): Promise<{ approved: true }> {
    await this.tenantKybService.approveTenant(tenantId, request.platformAdmin!.id);
    return { approved: true };
  }

  @Post('platform/tenants/:tenantId/reject')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiJoiBody(tenantRejectionSchema)
  @ApiResponseSchema(201, rejectedTenantResponseSchema)
  async rejectTenant(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
    @Body(new JoiValidationPipe(tenantRejectionSchema)) body: TenantRejectionRequest,
    @Req() request: RequestWithPlatformAdmin,
  ): Promise<{ rejected: true }> {
    await this.tenantKybService.rejectTenant(
      tenantId,
      request.platformAdmin!.id,
      body.reason,
    );
    return { rejected: true };
  }

  @Get('platform/stats')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformStatsResponseSchema)
  getPlatformStats() {
    return this.platformService.getPlatformStats();
  }

  @Get('platform/fiscalization')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, platformFiscalizationResponseSchema)
  getFiscalizationConfiguration() {
    return this.fiscalizationService.getPlatformConfiguration();
  }

  @Put('platform/fiscalization/providers/:jurisdiction')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, fiscalProviderConfigurationResponseSchema)
  @ApiJoiBody(fiscalProviderConfigurationSchema)
  configureFiscalProvider(
    @Param('jurisdiction', new JoiValidationPipe(fiscalJurisdictionSchema)) jurisdiction: FiscalJurisdiction,
    @Body(new JoiValidationPipe(fiscalProviderConfigurationSchema)) body: FiscalProviderConfigurationRequest,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.fiscalizationService.configureProvider(
      jurisdiction,
      body,
      request.platformAdmin!.id,
    );
  }

  @Put('platform/fiscalization/addon-offer')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, fiscalAddonOfferResponseSchema)
  @ApiJoiBody(fiscalAddonOfferSchema)
  configureFiscalAddonOffer(
    @Body(new JoiValidationPipe(fiscalAddonOfferSchema)) body: FiscalAddonOfferRequest,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.fiscalizationService.configureAddonOffer(body, request.platformAdmin!.id);
  }

  @Patch('platform/fiscalization/addon-requests/:requestId')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiResponseSchema(200, fiscalAddonRequestUpdateResponseSchema)
  @ApiJoiBody(fiscalAddonRequestUpdateSchema)
  updateFiscalAddonRequest(
    @Param('requestId', new JoiValidationPipe(productIdSchema)) requestId: string,
    @Body(new JoiValidationPipe(fiscalAddonRequestUpdateSchema)) body: FiscalAddonRequestUpdate,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.fiscalizationService.updateAddonRequest(
      requestId,
      body,
      request.platformAdmin!.id,
    );
  }

  @Get('platform/payment-providers')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  listPaymentProviders() {
    return this.paymentProviderService.list();
  }

  @Get('platform/payment-providers/:provider')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  getPaymentProvider(
    @Param('provider', new JoiValidationPipe(paymentProviderNameSchema)) provider: PaymentProviderName,
  ) {
    return this.paymentProviderService.get(provider);
  }

  @Put('platform/payment-providers/:provider')
  @ApiBearerAuth('platformBearer')
  @UseGuards(PlatformAuthGuard)
  @ApiJoiBody(paymentProviderConfigSchema)
  upsertPaymentProvider(
    @Param('provider', new JoiValidationPipe(paymentProviderNameSchema)) provider: PaymentProviderName,
    @Body(new JoiValidationPipe(paymentProviderConfigSchema)) body: PlatformPaymentProviderConfig,
    @Req() request: RequestWithPlatformAdmin,
  ) {
    return this.paymentProviderService.upsert(provider, body, request.platformAdmin!.id);
  }

  @Post('platform/payment-providers/:provider/webhook')
  @UsePipes(new JoiValidationPipe(paymentWebhookBodySchema))
  async handlePaymentWebhook(
    @Param('provider', new JoiValidationPipe(paymentProviderNameSchema)) provider: PaymentProviderName,
    @Headers('x-signature') signature: string | undefined,
    @Req() request: Request,
  ) {
    const rawBody = (request as any).rawBody;
    if (!rawBody) {
      throw new BadRequestException('Missing raw request body for signature verification.');
    }

    if (!signature) {
      throw new UnauthorizedException('Missing webhook signature header.');
    }

    const isValid = await this.paymentProviderService.verifyWebhookSignature(
      provider,
      rawBody,
      signature,
    );
    if (!isValid) {
      throw new UnauthorizedException('Invalid webhook signature.');
    }

    const body = JSON.parse(rawBody.toString()) as {
      eventType: string;
      providerRef: string;
      invoiceId?: string | null;
      amount: string;
      currency: string;
      status: 'PAID' | 'FAILED' | 'CANCELED' | 'PENDING';
      metadata?: Record<string, unknown> | null;
    };

    return this.paymentProviderService.handleWebhook(provider, body);
  }

  private setPlatformRefreshCookie(response: Response, token: string) {
    response.cookie('spos_platform_refresh', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/platform/auth',
      maxAge: 30 * 24 * 60 * 60 * 1000,
    });
  }

  private clearPlatformRefreshCookie(response: Response) {
    response.clearCookie('spos_platform_refresh', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/api/v1/platform/auth',
    });
  }

  private readCookie(header: string | undefined, name: string): string | undefined {
    const cookie = header?.split(';').map((part) => part.trim())
      .find((part) => part.startsWith(`${name}=`));
    if (!cookie) return undefined;
    try {
      return decodeURIComponent(cookie.slice(name.length + 1));
    } catch {
      return undefined;
    }
  }

  private assertTrustedOrigin(origin: string | undefined): void {
    if (!origin) {
      if (process.env.NODE_ENV === 'production') {
        throw new ForbiddenException('An allowed request origin is required.');
      }
      return;
    }
    const allowedOrigins = (process.env.CORS_ORIGINS ?? 'http://localhost:5173')
      .split(',')
      .map((item) => item.trim());
    if (!allowedOrigins.includes(origin)) {
      throw new ForbiddenException('Request origin is not allowed.');
    }
  }
}