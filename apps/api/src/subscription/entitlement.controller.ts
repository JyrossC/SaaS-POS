import {
  Controller,
  Get,
  Req,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { RequirePermissions } from '../authorization/permission.decorator';
import { PermissionGuard } from '../authorization/permission.guard';
import { EntitlementService } from './entitlement.service';

@Controller('subscription')
@UseGuards(AuthGuard, PermissionGuard)
export class EntitlementController {
  constructor(private readonly entitlementService: EntitlementService) {}

  @Get('modules')
  @RequirePermissions('dashboard.view')
  async getModuleStatus(@Req() request: RequestWithUser) {
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated user context is required.');
    }

    const context = await this.entitlementService.getContext(user.tenantId);

    return {
      subscriptionStatus: context.subscriptionStatus,
      modules: [...context.platformModules].sort().map((moduleKey) => ({
        moduleKey,
        enabled: this.entitlementService.canAccessModule(user, context, moduleKey),
      })),
      planLimits: this.entitlementService.getPlanLimits(context),
      usage: this.entitlementService.getUsage(context),
    };
  }
}
