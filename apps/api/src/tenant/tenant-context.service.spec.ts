import { ForbiddenException } from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { TenantContextService } from './tenant-context.service';

describe('TenantContextService', () => {
  const service = new TenantContextService();
  const request = {
    user: {
      id: 'user-1',
      membershipId: 'membership-1',
      tenantId: 'tenant-1',
      email: 'manager@example.com',
      role: 'Store Manager',
      roleNames: ['Store Manager'],
      permissions: ['inventory.view'],
      storeIds: ['store-1'],
      allStoreAccess: false,
    },
  } as RequestWithUser;

  it('resolves tenant context from the authenticated membership', () => {
    expect(service.resolveTenantId(request)).toBe('tenant-1');
  });

  it('rejects a tenant outside the authenticated membership', () => {
    expect(() => service.ensureTenantAccess(request, 'tenant-2')).toThrow(ForbiddenException);
  });

  it('rejects a store outside the membership scope', () => {
    expect(() => service.ensureTenantAccess(request, 'tenant-1', 'store-2')).toThrow(
      ForbiddenException,
    );
  });

  it('allows a store explicitly assigned to the membership', () => {
    expect(() => service.ensureTenantAccess(request, 'tenant-1', 'store-1')).not.toThrow();
  });
});
