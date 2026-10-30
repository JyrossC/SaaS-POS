import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { EntitlementService, TenantEntitlementContext } from './entitlement.service';

describe('EntitlementService', () => {
  let service: EntitlementService;
  const prisma = {
    tenant: { findUnique: jest.fn() },
    platformModule: { findMany: jest.fn() },
    store: { count: jest.fn() },
    membership: { count: jest.fn() },
  };

  const user: AuthenticatedUser = {
    id: 'user-1',
    membershipId: 'membership-1',
    tenantId: 'tenant-1',
    email: 'owner@example.com',
    role: 'Tenant Owner',
    roleNames: ['Tenant Owner'],
    permissions: ['products.view', 'stores.create', 'staff.invite'],
    storeIds: [],
    allStoreAccess: true,
  };

  const activeContext: TenantEntitlementContext = {
    tenantId: 'tenant-1',
    tenantActive: true,
    subscriptionStatus: 'ACTIVE',
    subscriptionCurrent: true,
    planEntitlements: new Map<string, unknown>([
      ['products', true],
      ['stores', true],
      ['staff', true],
      ['limit.stores', 2],
      ['limit.staff', 3],
    ]),
    enabledModules: new Set(['products', 'stores', 'staff']),
    platformModules: new Set(['products', 'stores', 'staff']),
    limits: new Map([
      ['stores', 2],
      ['staff', 3],
    ]),
    storeCount: 1,
    staffCount: 2,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new EntitlementService(prisma as unknown as PrismaService);
  });

  it('allows module access only when platform, plan, tenant, and permission checks pass', () => {
    expect(service.canAccessModule(user, activeContext, 'products')).toBe(true);
    expect(service.canAccessModule(user, activeContext, 'pharmacy')).toBe(false);
  });

  it('blocks module access when the subscription is suspended', () => {
    expect(
      service.canAccessModule(user, { ...activeContext, subscriptionStatus: 'SUSPENDED' }, 'products'),
    ).toBe(false);
  });

  it('blocks module access while a subscription is pending payment', () => {
    expect(
      service.canAccessModule(
        user,
        { ...activeContext, subscriptionStatus: 'PENDING_PAYMENT' },
        'products',
      ),
    ).toBe(false);
  });

  it('blocks module access when the user lacks permission', () => {
    expect(
      service.canAccessModule(
        { ...user, permissions: [] },
        activeContext,
        'products',
      ),
    ).toBe(false);
  });

  it('blocks an authenticated user when the entitlement context belongs to another tenant', () => {
    expect(
      service.canAccessModule(
        user,
        { ...activeContext, tenantId: 'tenant-2' },
        'products',
      ),
    ).toBe(false);
  });

  it('enforces plan limits for store and staff creation', () => {
    expect(service.canCreateStore(user, activeContext)).toBe(true);
    expect(service.canInviteStaff(user, activeContext)).toBe(true);
    expect(
      service.canCreateStore(user, { ...activeContext, storeCount: 2 }),
    ).toBe(false);
    expect(
      service.canInviteStaff(user, { ...activeContext, staffCount: 3 }),
    ).toBe(false);
  });

  it('throws when module access is required but unavailable', () => {
    expect(() => service.assertModuleAccess(user, activeContext, 'pharmacy')).toThrow(
      ForbiddenException,
    );
  });

  it('does not activate subscriptions before their configured start date', async () => {
    prisma.tenant.findUnique.mockResolvedValue({
      status: 'ACTIVE',
      subscription: {
        status: 'ACTIVE',
        startsAt: new Date('2099-01-01T00:00:00.000Z'),
        endsAt: null,
        planVersion: {
          entitlements: [{ key: 'products', value: true }],
        },
      },
      moduleSettings: [{ moduleKey: 'products', enabled: true }],
    });
    prisma.platformModule.findMany.mockResolvedValue([{ moduleKey: 'products' }]);
    prisma.store.count.mockResolvedValue(0);
    prisma.membership.count.mockResolvedValue(0);

    const context = await service.getContext('tenant-1');

    expect(context.subscriptionStatus).toBe('ACTIVE');
    expect(context.subscriptionCurrent).toBe(false);
    expect(service.canAccessModule(user, context, 'products')).toBe(false);
  });
});
