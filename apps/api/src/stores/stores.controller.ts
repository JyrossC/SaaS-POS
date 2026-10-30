import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
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
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  createStoreSchema,
  listStoresSchema,
  storeIdSchema,
  updateStoreSchema,
} from '../common/validation/schemas';
import { TenantContextService } from '../tenant/tenant-context.service';
import { CreateStoreInput, ListStoresInput, UpdateStoreInput, StoresService } from './stores.service';

@Controller('stores')
@UseGuards(AuthGuard, PermissionGuard)
export class StoresController {
  constructor(
    private readonly storesService: StoresService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('stores.create')
  @UsePipes(new JoiValidationPipe(createStoreSchema))
  async create(
    @Req() request: RequestWithUser,
    @Body() body: CreateStoreInput,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    this.tenantContext.ensureTenantAccess(request, user.tenantId);
    return this.storesService.createStore(user, body);
  }

  @Get()
  @RequirePermissions('stores.view')
  @UsePipes(new JoiValidationPipe(listStoresSchema))
  async list(
    @Req() request: RequestWithUser,
    @Query() query: ListStoresInput,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    return this.storesService.listStores(user.tenantId, query);
  }

  @Get(':storeId')
  @RequirePermissions('stores.view')
  @UsePipes(new JoiValidationPipe(storeIdSchema))
  async getById(
    @Req() request: RequestWithUser,
    @Param('storeId') storeId: string,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    return this.storesService.getStore(user.tenantId, storeId);
  }

  @Patch(':storeId')
  @RequirePermissions('stores.update')
  @UsePipes(new JoiValidationPipe(updateStoreSchema))
  async update(
    @Req() request: RequestWithUser,
    @Param('storeId', new JoiValidationPipe(storeIdSchema)) storeId: string,
    @Body() body: UpdateStoreInput,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    return this.storesService.updateStore(user.tenantId, storeId, user, body);
  }

  @Patch(':storeId/deactivate')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('stores.update')
  @UsePipes(new JoiValidationPipe(storeIdSchema))
  async deactivate(
    @Req() request: RequestWithUser,
    @Param('storeId', new JoiValidationPipe(storeIdSchema)) storeId: string,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    this.tenantContext.ensureTenantAccess(request, user.tenantId, storeId);
    return this.storesService.deactivateStore(user.tenantId, storeId, user);
  }
}
