import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { REQUIRED_PERMISSIONS_KEY } from './permission.decorator';

describe('PermissionGuard', () => {
  let guard: PermissionGuard;

  beforeEach(() => {
    guard = new PermissionGuard(new Reflector());
  });

  it('allows requests when a user has all required permissions', () => {
    const handler = {};
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'u-1',
            membershipId: 'm-1',
            tenantId: 'tenant-1',
            email: 'admin@example.com',
            role: 'tenant_admin',
            roleNames: ['tenant_admin'],
            permissions: ['dashboard.view', 'sales.view'],
            storeIds: [],
            allStoreAccess: true,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['dashboard.view', 'sales.view'], handler);

    expect(guard.canActivate(context)).toBe(true);
  });

  it('rejects requests when permissions are missing', () => {
    const handler = {};
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({
          user: {
            id: 'u-1',
            membershipId: 'm-1',
            tenantId: 'tenant-1',
            email: 'cashier@example.com',
            role: 'cashier',
            roleNames: ['cashier'],
            permissions: ['sales.view'],
            storeIds: [],
            allStoreAccess: false,
          },
        }),
      }),
    } as unknown as ExecutionContext;

    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['dashboard.view'], handler);

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('rejects unauthenticated access', () => {
    const handler = {};
    const context = {
      getHandler: () => handler,
      getClass: () => class TestController {},
      switchToHttp: () => ({
        getRequest: () => ({}),
      }),
    } as unknown as ExecutionContext;

    Reflect.defineMetadata(REQUIRED_PERMISSIONS_KEY, ['dashboard.view'], handler);

    expect(() => guard.canActivate(context)).toThrow(UnauthorizedException);
  });
});
