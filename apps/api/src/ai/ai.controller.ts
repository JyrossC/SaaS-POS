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
} from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../authorization/permission.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { TenantContextService } from '../tenant/tenant-context.service';
import { AIQueryRequest, AIService } from './ai.service';

@Controller('ai')
@UseGuards(AuthGuard, PermissionGuard)
export class AIController {
  constructor(
    private readonly aiService: AIService,
    private readonly tenantContext: TenantContextService,
  ) {}

  @Post('query')
  @HttpCode(HttpStatus.OK)
  @RequirePermissions('reports.view')
  async query(
    @Req() request: RequestWithUser,
    @Body() body: AIQueryRequest,
  ) {
    const user = request.user;
    if (!user) throw new UnauthorizedException('Authenticated user context is required.');
    this.tenantContext.ensureTenantAccess(request, user.tenantId);
    return this.aiService.processQuery(user.tenantId, body);
  }

  @Get('capabilities')
  @RequirePermissions('reports.view')
  async getCapabilities() {
    return {
      supportedQueries: [
        'sales summary',
        'inventory status',
        'top products',
        'store comparison',
        'low stock alerts',
      ],
      description: 'AI analytics supports natural language queries about sales, inventory, and store performance.',
    };
  }
}
