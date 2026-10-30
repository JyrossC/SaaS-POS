import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { TenantContextService } from './tenant-context.service';

describe('Tenant isolation', () => {
  const service = new TenantContextService();

  const makeRequest = (overrides: Partial<{
    tenantId: string;
    storeIds: string[];
    allStoreAccess: boolean;
  }> = {}): RequestWithUser =>
    ({
      user: {
        id: 'user-1',
        membershipId: 'membership-1',
        tenantId: overrides.tenantId ?? 'tenant-1',
        email: 'owner@example.com',
        role: 'Tenant Owner',
        roleNames: ['Tenant Owner'],
        permissions: ['products.view'],
        storeIds: overrides.storeIds ?? ['store-1'],
        allStoreAccess: overrides.allStoreAccess ?? false,
      },
    } as RequestWithUser);

  describe('resolveTenantId', () => {
    it('returns the authenticated tenant id', () => {
      expect(service.resolveTenantId(makeRequest())).toBe('tenant-1');
    });

    it('throws when there is no authenticated user', () => {
      expect(() =>
        service.resolveTenantId({ user: undefined } as RequestWithUser),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('ensureTenantAccess', () => {
    it('allows access to the matching tenant', () => {
      expect(() =>
        service.ensureTenantAccess(makeRequest(), 'tenant-1'),
      ).not.toThrow();
    });

    it('blocks access to a different tenant', () => {
      expect(() =>
        service.ensureTenantAccess(makeRequest(), 'tenant-2'),
      ).toThrow(ForbiddenException);
    });

    it('allows access to an explicitly scoped store', () => {
      expect(() =>
        service.ensureTenantAccess(makeRequest(), 'tenant-1', 'store-1'),
      ).not.toThrow();
    });

    it('blocks access to a store outside the membership scope', () => {
      expect(() =>
        service.ensureTenantAccess(makeRequest(), 'tenant-1', 'store-99'),
      ).toThrow(ForbiddenException);
    });

    it('allows any store when allStoreAccess is true', () => {
      expect(() =>
        service.ensureTenantAccess(
          makeRequest({ allStoreAccess: true }),
          'tenant-1',
          'store-99',
        ),
      ).not.toThrow();
    });

    it('rejects a request with no user', () => {
      expect(() =>
        service.ensureTenantAccess({ user: undefined } as RequestWithUser, 'tenant-1'),
      ).toThrow(UnauthorizedException);
    });
  });

  describe('cross-tenant access prevention', () => {
    it('user from tenant-1 cannot access tenant-2 resources', () => {
      expect(() =>
        service.ensureTenantAccess(makeRequest({ tenantId: 'tenant-1' }), 'tenant-2'),
      ).toThrow(ForbiddenException);
    });

    it('user from tenant-2 cannot access tenant-1 resources', () => {
      expect(() =>
        service.ensureTenantAccess(makeRequest({ tenantId: 'tenant-2' }), 'tenant-1'),
      ).toThrow(ForbiddenException);
    });

    it('a store owned by tenant-1 is inaccessible to a tenant-2 user', () => {
      expect(() =>
        service.ensureTenantAccess(
          makeRequest({ tenantId: 'tenant-2', storeIds: ['store-x'] }),
          'tenant-1',
          'store-1',
        ),
      ).toThrow(ForbiddenException);
    });
  });
});