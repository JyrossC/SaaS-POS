import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';

@Injectable()
export class TenantOnboardingGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }

    if (
      !user.roleNames.includes('Tenant Owner') ||
      !['PENDING_REVIEW', 'REJECTED'].includes(user.tenantStatus)
    ) {
      throw new ForbiddenException('Tenant onboarding access is unavailable.');
    }

    return true;
  }
}
