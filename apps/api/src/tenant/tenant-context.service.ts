import { ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { AuthenticatedUser } from '../auth/auth.types';
import { RequestWithUser } from '../auth/auth.guard';

@Injectable()
export class TenantContextService {
  resolveTenantId(request: RequestWithUser): string {
    const user = request.user as AuthenticatedUser | undefined;

    if (!user?.tenantId) {
      throw new UnauthorizedException('Authenticated tenant context is required.');
    }

    return user.tenantId;
  }

  resolveStoreIds(request: RequestWithUser): string[] {
    const user = request.user as AuthenticatedUser | undefined;
    return user?.storeIds ?? [];
  }

  ensureTenantAccess(request: RequestWithUser, tenantId: string, storeId?: string): void {
    const user = request.user as AuthenticatedUser | undefined;

    if (!user) {
      throw new UnauthorizedException('Authenticated context is required.');
    }

    if (user.tenantId !== tenantId) {
      throw new ForbiddenException('The requested tenant does not match the authenticated user context.');
    }

    if (storeId && !user.allStoreAccess && !user.storeIds.includes(storeId)) {
      throw new ForbiddenException('The requested store is outside the authenticated scope.');
    }
  }
}
