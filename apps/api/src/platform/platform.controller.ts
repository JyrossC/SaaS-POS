import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  installationSchema,
  kybDocumentReviewSchema,
  kybDocumentUploadSchema,
  paymentProviderConfigSchema,
  paymentProviderNameSchema,
  paymentWebhookBodySchema,
  platformLoginSchema,
  productIdSchema,
} from '../common/validation/schemas';
import { PlatformAuthGuard } from './platform-auth.guard';
import { PlatformAuthService } from './platform-auth.service';
import { PlatformPaymentProviderService } from './platform-payment-provider.service';
import { PlatformService } from './platform.service';
import { TenantKybService, UploadedKybFile } from './tenant-kyb.service';
import {
  InstallationRequest,
  KybDocumentReviewRequest,
  KybDocumentUploadRequest,
  PaymentProviderName,
  PlatformLoginRequest,
  PlatformPaymentProviderConfig,
  RequestWithPlatformAdmin,
} from './platform.types';

@Controller()
export class PlatformController {
  constructor(
    private readonly platformService: PlatformService,
    private readonly platformAuthService: PlatformAuthService,
    private readonly paymentProviderService: PlatformPaymentProviderService,
    private readonly tenantKybService: TenantKybService,
  ) {}

  @Get('installation/status')
  getInstallationStatus() {
    return this.platformService.getInstallationStatus();
  }

  @Post('installation/initialize')
  @UsePipes(new JoiValidationPipe(installationSchema))
  initialize(
    @Body() body: InstallationRequest,
    @Headers('x-installation-secret') installationSecret?: string,
  ) {
    return this.platformService.initialize(body, installationSecret);
  }

  @Post('platform/auth/login')
  @UsePipes(new JoiValidationPipe(platformLoginSchema))
  login(@Body() body: PlatformLoginRequest) {
    return this.platformAuthService.login(body);
  }

  @Get('platform/me')
  @UseGuards(PlatformAuthGuard)
  getCurrentPlatformAdmin(@Req() request: RequestWithPlatformAdmin) {
    return request.platformAdmin;
  }

  @Post('platform/tenants/:tenantId/kyb-documents')
  @UseGuards(PlatformAuthGuard)
  @UseInterceptors(FileInterceptor('document', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }))
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
  @UseGuards(PlatformAuthGuard)
  listTenantKybDocuments(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
  ) {
    return this.tenantKybService.list(tenantId);
  }

  @Get('platform/tenants/:tenantId/kyb-documents/:documentId/content')
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
  @UseGuards(PlatformAuthGuard)
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
  @UseGuards(PlatformAuthGuard)
  async approveTenant(
    @Param('tenantId', new JoiValidationPipe(productIdSchema)) tenantId: string,
    @Req() request: RequestWithPlatformAdmin,
  ): Promise<{ approved: true }> {
    await this.tenantKybService.approveTenant(tenantId, request.platformAdmin!.id);
    return { approved: true };
  }

  @Get('platform/stats')
  getPlatformStats() {
    return this.platformService.getPlatformStats();
  }

  @Get('platform/payment-providers')
  @UseGuards(PlatformAuthGuard)
  listPaymentProviders() {
    return this.paymentProviderService.list();
  }

  @Get('platform/payment-providers/:provider')
  @UseGuards(PlatformAuthGuard)
  getPaymentProvider(
    @Param('provider', new JoiValidationPipe(paymentProviderNameSchema)) provider: PaymentProviderName,
  ) {
    return this.paymentProviderService.get(provider);
  }

  @Put('platform/payment-providers/:provider')
  @UseGuards(PlatformAuthGuard)
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
}