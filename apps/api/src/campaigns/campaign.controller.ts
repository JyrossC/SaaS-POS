import {
  Body,
  Controller,
  Delete,
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
import { CampaignService, CreateCampaignInput, UpdateCampaignInput, CampaignQuery, CreateCustomerSegmentInput, UpdateCustomerSegmentInput } from './campaign.service';
import { JoiValidationPipe } from '../common/validation/joi-validation.pipe';
import {
  createCampaignSchema,
  updateCampaignSchema,
  campaignQuerySchema,
  campaignIdParamSchema,
  createCustomerSegmentSchema,
  updateCustomerSegmentSchema,
  customerSegmentIdParamSchema,
} from '../common/validation/schemas';

@Controller('campaigns')
@UseGuards(AuthGuard, PermissionGuard)
export class CampaignController {
  constructor(private readonly campaignService: CampaignService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('campaigns.create')
  @UsePipes(new JoiValidationPipe(createCampaignSchema))
  async createCampaign(
    @Req() request: RequestWithUser,
    @Body() body: CreateCampaignInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.createCampaign(user.tenantId, user, body);
  }

  @Get()
  @RequirePermissions('campaigns.view')
  @UsePipes(new JoiValidationPipe(campaignQuerySchema))
  async listCampaigns(
    @Req() request: RequestWithUser,
    @Query() query: CampaignQuery,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.listCampaigns({ ...query, tenantId: user.tenantId });
  }

  @Get(':campaignId')
  @RequirePermissions('campaigns.view')
  @UsePipes(new JoiValidationPipe(campaignIdParamSchema))
  async getCampaign(
    @Req() request: RequestWithUser,
    @Param('campaignId') campaignId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.getCampaign(user.tenantId, campaignId);
  }

  @Patch(':campaignId')
  @RequirePermissions('campaigns.update')
  @UsePipes(new JoiValidationPipe(updateCampaignSchema))
  async updateCampaign(
    @Req() request: RequestWithUser,
    @Param('campaignId') campaignId: string,
    @Body() body: UpdateCampaignInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.updateCampaign(user.tenantId, campaignId, user, body);
  }

  @Delete(':campaignId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('campaigns.delete')
  @UsePipes(new JoiValidationPipe(campaignIdParamSchema))
  async deleteCampaign(
    @Req() request: RequestWithUser,
    @Param('campaignId') campaignId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.deleteCampaign(user.tenantId, campaignId);
  }

  @Get(':campaignId/analytics')
  @RequirePermissions('campaigns.view')
  async getCampaignAnalytics(
    @Req() request: RequestWithUser,
    @Param('campaignId') campaignId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.getCampaignAnalytics(user.tenantId, campaignId);
  }

  // ========================================================================
  // Customer Segments
  // ========================================================================

  @Post('segments')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('campaigns.create')
  @UsePipes(new JoiValidationPipe(createCustomerSegmentSchema))
  async createCustomerSegment(
    @Req() request: RequestWithUser,
    @Body() body: CreateCustomerSegmentInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.createCustomerSegment(user.tenantId, user, body);
  }

  @Get('segments')
  @RequirePermissions('campaigns.view')
  async listCustomerSegments(
    @Req() request: RequestWithUser,
    @Query('type') type?: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.listCustomerSegments(user.tenantId, type);
  }

  @Get('segments/:segmentId')
  @RequirePermissions('campaigns.view')
  @UsePipes(new JoiValidationPipe(customerSegmentIdParamSchema))
  async getCustomerSegment(
    @Req() request: RequestWithUser,
    @Param('segmentId') segmentId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.getCustomerSegment(user.tenantId, segmentId);
  }

  @Patch('segments/:segmentId')
  @RequirePermissions('campaigns.update')
  @UsePipes(new JoiValidationPipe(updateCustomerSegmentSchema))
  async updateCustomerSegment(
    @Req() request: RequestWithUser,
    @Param('segmentId') segmentId: string,
    @Body() body: UpdateCustomerSegmentInput,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.updateCustomerSegment(user.tenantId, segmentId, body);
  }

  @Delete('segments/:segmentId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('campaigns.delete')
  @UsePipes(new JoiValidationPipe(customerSegmentIdParamSchema))
  async deleteCustomerSegment(
    @Req() request: RequestWithUser,
    @Param('segmentId') segmentId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.deleteCustomerSegment(user.tenantId, segmentId);
  }

  @Post('segments/:segmentId/customers/:customerId')
  @HttpCode(HttpStatus.CREATED)
  @RequirePermissions('campaigns.update')
  @UsePipes(new JoiValidationPipe(customerSegmentIdParamSchema))
  async addCustomerToSegment(
    @Req() request: RequestWithUser,
    @Param('segmentId') segmentId: string,
    @Param('customerId') customerId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.addCustomerToSegment(user.tenantId, segmentId, customerId);
  }

  @Delete('segments/:segmentId/customers/:customerId')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('campaigns.update')
  @UsePipes(new JoiValidationPipe(customerSegmentIdParamSchema))
  async removeCustomerFromSegment(
    @Req() request: RequestWithUser,
    @Param('segmentId') segmentId: string,
    @Param('customerId') customerId: string,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    return this.campaignService.removeCustomerFromSegment(user.tenantId, segmentId, customerId);
  }
}
