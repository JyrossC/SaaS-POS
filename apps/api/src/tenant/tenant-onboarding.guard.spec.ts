import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { RequestWithUser } from '../auth/auth.guard';
import { TenantOnboardingGuard } from './tenant-onboarding.guard';

describe('TenantOnboardingGuard', () => {
  const guard = new TenantOnboardingGuard();

  function createContext(user?: RequestWithUser['user']) {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
    } as unknown as ExecutionContext;
  }

  it.each(['PENDING_REVIEW', 'REJECTED'] as const)(
    'allows a tenant owner to access the application while %s',
    (tenantStatus) => {
      expect(
        guard.canActivate(
          createContext({
            id: 'owner',
            membershipId: 'membership',
            tenantId: 'tenant',
            tenantStatus,
            email: 'owner@example.com',
            role: 'Tenant Owner',
            roleNames: ['Tenant Owner'],
            permissions: [],
            storeIds: [],
            mfaEnabled: false,
            allStoreAccess: true,
          }),
        ),
      ).toBe(true);
    },
  );

  it('does not allow non-owners into the applicant portal', () => {
    expect(() =>
      guard.canActivate(
        createContext({
          id: 'staff',
          membershipId: 'membership',
          tenantId: 'tenant',
          tenantStatus: 'PENDING_REVIEW',
          email: 'staff@example.com',
          role: 'Store Manager',
          roleNames: ['Store Manager'],
          permissions: [],
          storeIds: [],
          mfaEnabled: false,
          allStoreAccess: false,
        }),
      ),
    ).toThrow(ForbiddenException);
  });

  it('requires an authenticated tenant principal', () => {
    expect(() => guard.canActivate(createContext())).toThrow(UnauthorizedException);
  });
});
