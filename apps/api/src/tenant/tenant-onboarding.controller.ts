import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes } from '@nestjs/swagger';
import { AuthGuard, RequestWithUser } from '../auth/auth.guard';
import { joiSchemaToOpenApiSchema } from '../common/openapi/joi-body.decorator';
import { ApiResponseSchema } from '../common/openapi/response-schema.decorator';
import {
  tenantApplicantStatusResponseSchema,
  tenantKybDocumentResponseSchema,
} from '../common/openapi/response-schemas';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import { kybDocumentUploadSchema } from '../common/validation/schemas';
import { KybDocumentUploadRequest } from '../platform/platform.types';
import { TenantKybService, UploadedKybFile } from '../platform/tenant-kyb.service';
import { TenantOnboardingGuard } from './tenant-onboarding.guard';

@ApiBearerAuth('bearer')
@Controller('tenant/onboarding')
@UseGuards(AuthGuard, TenantOnboardingGuard)
export class TenantOnboardingController {
  constructor(private readonly tenantKybService: TenantKybService) {}

  @Get('status')
  @ApiResponseSchema(200, tenantApplicantStatusResponseSchema)
  getStatus(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.tenantKybService.getApplicantStatus(user.tenantId);
  }

  @Post('kyb-documents')
  @UseInterceptors(
    FileInterceptor('document', { limits: { fileSize: 10 * 1024 * 1024, files: 1 } }),
  )
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
  @ApiResponseSchema(201, tenantKybDocumentResponseSchema)
  @UsePipes(new JoiValidationPipe(kybDocumentUploadSchema))
  uploadDocument(
    @Req() request: RequestWithUser,
    @Body() body: KybDocumentUploadRequest,
    @UploadedFile() file: UploadedKybFile,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }
    return this.tenantKybService.uploadForTenantOwner(
      user.tenantId,
      user.membershipId,
      user.id,
      body.documentName,
      file,
    );
  }
}
