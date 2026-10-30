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
  productIdParamSchema,
  daysQuerySchema,
  quarantineIdParamSchema,
  prescriptionIdParamSchema,
  createPrescriptionSchema,
} from '../common/validation/schemas';
import {
  CreateBatchInput,
  CreateDrugDetailInput,
  CreatePrescriptionInput,
  DispenseInput,
  PharmacyService,
  QuarantineInput,
} from './pharmacy.service';

@Controller('pharmacy')
@UseGuards(AuthGuard, PermissionGuard)
export class PharmacyController {
  constructor(
    private readonly pharmacyService: PharmacyService,
    private readonly tenantContext: TenantContextService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Post('drug-details')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('pharmacy.batches.create')
  async createDrugDetail(
    @Req() request: RequestWithUser,
    @Body() body: CreateDrugDetailInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy', true);
    return this.pharmacyService.createDrugDetail(user.tenantId, body);
  }

  @Get('drug-details/:productId')
  @RequirePermissions('pharmacy.batches.view')
  @UsePipes(new JoiValidationPipe(productIdParamSchema))
  async getDrugDetail(
    @Req() request: RequestWithUser,
    @Param('productId') productId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy');
    return this.pharmacyService.getDrugDetail(user.tenantId, productId);
  }

  @Post('batches')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('pharmacy.batches.create')
  async createBatch(
    @Req() request: RequestWithUser,
    @Body() body: CreateBatchInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, body.storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy', true);
    return this.pharmacyService.createBatch(user.tenantId, user, body);
  }

  @Get('batches')
  @RequirePermissions('pharmacy.batches.view')
  async listBatches(
    @Req() request: RequestWithUser,
    @Query('productId') productId?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy');
    return this.pharmacyService.listBatches(
      user.tenantId,
      productId,
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Get('batches/expiring')
  @RequirePermissions('pharmacy.batches.view')
  @UsePipes(new JoiValidationPipe(daysQuerySchema))
  async getExpiringBatches(
    @Req() request: RequestWithUser,
    @Query('days') days?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy');
    return this.pharmacyService.getExpiringBatches(
      user.tenantId,
      parseInt(days || '30', 10),
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Post('dispense')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('pharmacy.dispensing.create')
  async dispense(
    @Req() request: RequestWithUser,
    @Body() body: DispenseInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, body.storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy', true);
    return this.pharmacyService.dispense(user.tenantId, user, body);
  }

  @Post('prescriptions')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('pharmacy.batches.create')
  @UsePipes(new JoiValidationPipe(createPrescriptionSchema))
  async createPrescription(
    @Req() request: RequestWithUser,
    @Body() body: CreatePrescriptionInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, body.storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy', true);
    return this.pharmacyService.createPrescription(user.tenantId, user, body);
  }

  @Get('prescriptions')
  @RequirePermissions('pharmacy.batches.view')
  async listPrescriptions(
    @Req() request: RequestWithUser,
    @Query('storeId') storeId?: string,
    @Query('status') status?: string,
    @Query('patientName') patientName?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    if (storeId) this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy');
    return this.pharmacyService.listPrescriptions(
      user.tenantId,
      user.allStoreAccess ? undefined : user.storeIds,
      status,
      patientName,
    );
  }

  @Get('prescriptions/:prescriptionId')
  @RequirePermissions('pharmacy.batches.view')
  @UsePipes(new JoiValidationPipe(prescriptionIdParamSchema))
  async getPrescription(
    @Req() request: RequestWithUser,
    @Param('prescriptionId') prescriptionId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy');
    return this.pharmacyService.getPrescription(
      user.tenantId,
      prescriptionId,
      user.allStoreAccess ? undefined : user.storeIds,
    );
  }

  @Post('quarantine')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('pharmacy.batches.create')
  async quarantineStock(
    @Req() request: RequestWithUser,
    @Body() body: QuarantineInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId, body.storeId);
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy', true);
    return this.pharmacyService.quarantineStock(user.tenantId, user, body);
  }

  @Post('quarantine/:quarantineId/release')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('pharmacy.batches.create')
  @UsePipes(new JoiValidationPipe(quarantineIdParamSchema))
  async releaseQuarantine(
    @Req() request: RequestWithUser,
    @Param('quarantineId') quarantineId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'pharmacy', true);
    return this.pharmacyService.releaseQuarantine(user.tenantId, quarantineId, user);
  }
}
