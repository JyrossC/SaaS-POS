import {
  Body,
  Controller,
  Get,
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
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  createProductSchema,
  listProductsSchema,
  productIdSchema,
} from '../common/validation/schemas';
import { EntitlementService } from '../subscription/entitlement.service';
import { CreateProductInput, ListProductsInput, ProductsService } from './products.service';

@Controller('products')
@UseGuards(AuthGuard, PermissionGuard)
export class ProductsController {
  constructor(
    private readonly productsService: ProductsService,
    private readonly entitlementService: EntitlementService,
  ) {}

  @Get()
  @RequirePermissions('products.view')
  @UsePipes(new JoiValidationPipe(listProductsSchema))
  async list(
    @Req() request: RequestWithUser,
    @Query() query: ListProductsInput,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'products');
    return this.productsService.list(user.tenantId, query);
  }

  @Post()
  @RequirePermissions('products.create')
  @UsePipes(new JoiValidationPipe(createProductSchema))
  async create(
    @Req() request: RequestWithUser,
    @Body() body: CreateProductInput,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'products');
    return this.productsService.create(user.tenantId, user, body);
  }

  @Get(':productId')
  @RequirePermissions('products.view')
  async getById(
    @Req() request: RequestWithUser,
    @Param('productId', new JoiValidationPipe(productIdSchema)) productId: string,
  ) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }
    const context = await this.entitlementService.getContext(user.tenantId);
    this.entitlementService.assertModuleAccess(user, context, 'products');
    return this.productsService.getById(user.tenantId, productId);
  }
}
