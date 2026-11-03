import { test, expect } from '@playwright/test';

test.describe('SaaS POS Smoke Tests', () => {
  let currentUser: Record<string, unknown>;
  let requestedPaths: string[];
  let authRestoreFailure: number | null;
  let authRestoreSuccess: boolean;
  let registrationFailure: boolean;
  let platformInitialized: boolean;
  let tenantMfaRequired: boolean;
  let emailVerificationRequired: boolean;
  let platformMfaChallengeRequired: boolean;
  let supportGrantBody: Record<string, unknown> | null;
  let supportGrantCreated: boolean;
  let businessSettings: {
    id: string;
    name: string;
    businessType: 'RETAIL';
    businessAddress: string | null;
    contactEmail: string | null;
    contactPhone: string | null;
    currency: 'TZS';
    timezone: 'Africa/Dar_es_Salaam';
    taxEnabled: false;
    taxStatus: 'DISABLED_PENDING_REVIEW';
    receiptSettingsStatus: 'PENDING_LEGAL_REVIEW';
    notificationSettingsStatus: 'NOT_CONFIGURED';
    integrationsStatus: 'NOT_CONFIGURED';
  };
  let fiscalSettings: {
    providers: Array<Record<string, unknown>>;
    profiles: Array<Record<string, unknown>>;
    addonOffer: {
      isAvailable: boolean;
      isTestOnly: true;
      currency: string;
      monthlyPrice: string | null;
      annualPrice: string | null;
    };
    addonRequests: Array<Record<string, unknown>>;
    addonSubscriptions: Array<Record<string, unknown>>;
    testBillingEnabled: boolean;
    fiscalTransactionsEnabled: false;
    taxCalculationEnabled: false;
    fiscalReceiptIssuanceEnabled: false;
    simulator: { enabled: boolean; mode: 'SIMULATED_ONLY' };
  };
  let platformFiscalization: {
    providers: Array<Record<string, unknown>>;
    addonOffer: {
      id?: string;
      isAvailable: boolean;
      isTestOnly: true;
      currency: string;
      monthlyPrice: string | null;
      annualPrice: string | null;
    };
    addonRequests: Array<Record<string, unknown>>;
    addonSubscriptions: Array<Record<string, unknown>>;
    testBillingEnabled: boolean;
    fiscalTransactionsEnabled: false;
    taxCalculationEnabled: false;
    fiscalReceiptIssuanceEnabled: false;
  };
  let tenantRoles: Array<{
    id: string;
    name: string;
    description: string | null;
    isSystem: boolean;
    permissions: Array<{ permission: { code: string } }>;
    _count: { memberships: number; invitations: number };
  }>;
  const assignablePermissions = [
    { code: 'products.create', description: 'Create tenant products' },
    { code: 'products.view', description: 'View tenant products' },
    { code: 'roles.assign_permissions', description: 'Assign role permissions' },
    { code: 'roles.create', description: 'Create tenant roles' },
    { code: 'roles.update', description: 'Update tenant roles' },
    { code: 'roles.view', description: 'View tenant roles' },
    { code: 'staff.invite', description: 'Invite tenant staff' },
    { code: 'staff.view', description: 'View tenant staff' },
  ];

  test.beforeEach(async ({ page }) => {
    requestedPaths = [];
    authRestoreFailure = null;
    authRestoreSuccess = false;
    registrationFailure = false;
    platformInitialized = false;
    tenantMfaRequired = false;
    emailVerificationRequired = false;
    platformMfaChallengeRequired = false;
    supportGrantBody = null;
    supportGrantCreated = false;
    businessSettings = {
      id: 'e2e-tenant',
      name: 'Test Retail Store',
      businessType: 'RETAIL',
      businessAddress: null,
      contactEmail: null,
      contactPhone: null,
      currency: 'TZS',
      timezone: 'Africa/Dar_es_Salaam',
      taxEnabled: false,
      taxStatus: 'DISABLED_PENDING_REVIEW',
      receiptSettingsStatus: 'PENDING_LEGAL_REVIEW',
      notificationSettingsStatus: 'NOT_CONFIGURED',
      integrationsStatus: 'NOT_CONFIGURED',
    };
    fiscalSettings = {
      providers: [],
      profiles: [],
      addonOffer: {
        isAvailable: false,
        isTestOnly: true,
        currency: 'TZS',
        monthlyPrice: null,
        annualPrice: null,
      },
      addonRequests: [],
      addonSubscriptions: [],
      testBillingEnabled: false,
      fiscalTransactionsEnabled: false,
      taxCalculationEnabled: false,
      fiscalReceiptIssuanceEnabled: false,
      simulator: { enabled: false, mode: 'SIMULATED_ONLY' },
    };
    platformFiscalization = {
      providers: [],
      addonOffer: {
        isAvailable: false,
        isTestOnly: true,
        currency: 'TZS',
        monthlyPrice: null,
        annualPrice: null,
      },
      addonRequests: [],
      addonSubscriptions: [],
      testBillingEnabled: false,
      fiscalTransactionsEnabled: false,
      taxCalculationEnabled: false,
      fiscalReceiptIssuanceEnabled: false,
    };
    tenantRoles = [
      {
        id: 'tenant-owner-role',
        name: 'Tenant Owner',
        description: 'Full access to the tenant.',
        isSystem: true,
        permissions: [
          { permission: { code: 'roles.view' } },
          { permission: { code: 'roles.create' } },
          { permission: { code: 'roles.update' } },
          { permission: { code: 'roles.assign_permissions' } },
        ],
        _count: { memberships: 1, invitations: 0 },
      },
    ];
    currentUser = {
      id: 'e2e-user',
      tenantId: 'e2e-tenant',
      tenantName: 'Test Retail Store',
      name: 'Test Owner',
      email: 'owner@example.com',
      tenantStatus: 'ACTIVE',
      permissions: [
        'reports.view',
        'stores.view',
        'products.view',
        'inventory.view',
        'sales.view',
        'sales.create',
        'sales.refund',
        'purchases.view',
        'campaigns.view',
        'pharmacy.batches.view',
        'roles.view',
        'roles.create',
        'roles.update',
        'roles.assign_permissions',
        'business_settings.view',
        'business_settings.update',
        'fiscal_settings.view',
        'fiscal_settings.update',
        'staff.view',
        'staff.invite',
      ],
    };
    await page.route('**/api/v1/**', async (route) => {
      if (route.request().method() === 'OPTIONS') {
        const headers = route.request().headers();
        await route.fulfill({
          status: 204,
          headers: {
            'Access-Control-Allow-Origin': headers.origin ?? 'http://localhost:5173',
            'Access-Control-Allow-Credentials': 'true',
            'Access-Control-Allow-Methods': headers['access-control-request-method'] ?? 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': headers['access-control-request-headers'] ?? 'content-type',
          },
        });
        return;
      }

      const pathname = new URL(route.request().url()).pathname;
      requestedPaths.push(pathname);
      if (pathname.endsWith('/api/v1/auth/refresh') && authRestoreFailure) {
        await route.fulfill({
          status: authRestoreFailure,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: authRestoreFailure, message: 'Temporary API outage' }),
        });
        return;
      }
      if (pathname.endsWith('/api/v1/auth/refresh')) {
        if (authRestoreSuccess) {
          await route.fulfill({
            contentType: 'application/json',
            body: JSON.stringify({
              success: true,
              data: { accessToken: 'e2e-restored-token', user: currentUser },
            }),
          });
        } else {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ statusCode: 401, message: 'Refresh session is invalid or expired.' }),
          });
        }
        return;
      }
      if (pathname.endsWith('/platform/auth/refresh')) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({ statusCode: 401, message: 'Refresh session is invalid or expired.' }),
        });
        return;
      }
      if (pathname.endsWith('/auth/register') && registrationFailure) {
        await route.fulfill({
          status: 400,
          contentType: 'application/json',
          body: JSON.stringify({
            statusCode: 400,
            code: 'VALIDATION_ERROR',
            message: 'Request data is invalid.',
            details: [{ field: 'password', message: '"password" length must be at least 12 characters long' }],
          }),
        });
        return;
      }
      let data: unknown = {};

      if (pathname === '/api/v1/tenant/settings' && route.request().method() === 'GET') {
        data = businessSettings;
      } else if (pathname === '/api/v1/tenant/settings' && route.request().method() === 'PATCH') {
        businessSettings = {
          ...businessSettings,
          ...(route.request().postDataJSON() as Pick<
            typeof businessSettings,
            'name' | 'businessAddress' | 'contactEmail' | 'contactPhone'
          >),
        };
        data = businessSettings;
      } else if (pathname === '/api/v1/tenant/fiscalization' && route.request().method() === 'GET') {
        data = fiscalSettings;
      } else if (
        pathname === '/api/v1/tenant/fiscalization/addon-subscriptions' &&
        route.request().method() === 'GET'
      ) {
        data = [];
      } else if (
        pathname === '/api/v1/tenant/fiscalization/addon-subscriptions/checkout' &&
        route.request().method() === 'POST'
      ) {
        const body = route.request().postDataJSON() as {
          jurisdiction: string;
          billingPeriod: 'MONTHLY' | 'ANNUAL';
        };
        data = {
          id: 'test-invoice-e2e',
          tenantId: 'e2e-tenant',
          fiscalAddonSubscriptionId: 'test-subscription-e2e',
          fiscalBillingPeriod: body.billingPeriod,
          fiscalPeriodStartsAt: new Date().toISOString(),
          fiscalPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
          amount: body.billingPeriod === 'MONTHLY' ? '35000' : '400000',
          currency: 'TZS',
          status: 'PENDING_PAYMENT',
          isTestMode: true,
          createdAt: new Date().toISOString(),
        };
      } else if (
        pathname.endsWith('/simulate-payment') &&
        route.request().method() === 'POST'
      ) {
        data = {
          idempotent: false,
          simulationOnly: true,
          realChargeMade: false,
          subscriptionStatus: 'ACTIVE',
          payment: {
            id: 'test-payment-e2e',
            invoiceId: 'test-invoice-e2e',
            providerReference: 'fiscal-test-e2e',
            status: 'PAID',
            amount: '35000',
            currency: 'TZS',
            isTestMode: true,
            createdAt: new Date().toISOString(),
          },
          invoice: {
            id: 'test-invoice-e2e',
            tenantId: 'e2e-tenant',
            fiscalAddonSubscriptionId: 'test-subscription-e2e',
            fiscalBillingPeriod: 'MONTHLY',
            fiscalPeriodStartsAt: new Date().toISOString(),
            fiscalPeriodEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
            amount: '35000',
            currency: 'TZS',
            status: 'PAID',
            isTestMode: true,
            createdAt: new Date().toISOString(),
          },
        };
      } else if (
        pathname === '/api/v1/tenant/fiscalization/simulator/run' &&
        route.request().method() === 'POST'
      ) {
        const body = route.request().postDataJSON() as {
          jurisdiction: string;
          scenario: string;
        };
        data = {
          simulationOnly: true,
          officialReceiptIssued: false,
          salesRecordCreated: false,
          taxCalculated: false,
          providerContacted: false,
          ...body,
          outcome: `SIMULATED_${body.scenario}`,
          simulationId: 'simulation-e2e',
          simulatedAt: new Date().toISOString(),
          message: 'Synthetic result only.',
        };
      } else if (
        pathname.startsWith('/api/v1/tenant/fiscalization/profiles/') &&
        route.request().method() === 'PATCH'
      ) {
        const jurisdiction = pathname.split('/').at(-1);
        const body = route.request().postDataJSON() as {
          legalName: string | null;
          taxIdentificationNumber: string | null;
          vatRegistrationNumber: string | null;
          providerConfigurationId: string | null;
        };
        const savedProfile = {
          id: `profile-${jurisdiction}`,
          jurisdiction,
          ...body,
          credentialsConfigured: false,
          updatedAt: new Date().toISOString(),
        };
        fiscalSettings = {
          ...fiscalSettings,
          profiles: [
            ...fiscalSettings.profiles.filter((item) => item.jurisdiction !== jurisdiction),
            savedProfile,
          ],
        };
        data = savedProfile;
      } else if (pathname === '/api/v1/tenant/roles' && route.request().method() === 'GET') {
        data = tenantRoles;
      } else if (pathname === '/api/v1/tenant/roles' && route.request().method() === 'POST') {
        const body = route.request().postDataJSON() as {
          name: string;
          description: string | null;
          permissionCodes: string[];
        };
        const createdRole = {
          id: 'tenant-custom-role',
          name: body.name,
          description: body.description,
          isSystem: false,
          permissions: body.permissionCodes.map((code) => ({ permission: { code } })),
          _count: { memberships: 0, invitations: 0 },
        };
        tenantRoles = [...tenantRoles, createdRole];
        data = createdRole;
      } else if (pathname.startsWith('/api/v1/tenant/roles/') && route.request().method() === 'PATCH') {
        const roleId = pathname.split('/').at(-1);
        const body = route.request().postDataJSON() as {
          name?: string;
          description?: string | null;
          permissionCodes?: string[];
        };
        tenantRoles = tenantRoles.map((role) => role.id === roleId
          ? {
              ...role,
              ...(body.name !== undefined ? { name: body.name } : {}),
              ...(body.description !== undefined ? { description: body.description } : {}),
              ...(body.permissionCodes !== undefined
                ? { permissions: body.permissionCodes.map((code) => ({ permission: { code } })) }
                : {}),
            }
          : role);
        data = tenantRoles.find((role) => role.id === roleId);
      } else if (pathname === '/api/v1/tenant/permissions') {
        data = assignablePermissions;
      } else if (pathname.endsWith('/auth/register')) {
        data = {
          status: 'PENDING_REVIEW',
          message: 'Registration submitted. Your tenant is pending platform review.',
        };
      } else if (pathname.endsWith('/installation/status')) {
        data = { initialized: platformInitialized };
      } else if (pathname.endsWith('/installation/initialize')) {
        data = { initialized: true, platformName: 'Test Platform' };
      } else if (pathname.endsWith('/auth/password/forgot')) {
        data = {
          message: 'If an account exists for this address, password reset instructions will be sent.',
        };
      } else if (pathname.endsWith('/auth/password/reset')) {
        data = null;
      } else if (pathname.endsWith('/api/v1/auth/login')) {
        const credentials = route.request().postDataJSON() as { tenantSlug?: string; mfaCode?: string };
        if (emailVerificationRequired) {
          await route.fulfill({
            status: 403,
            contentType: 'application/json',
            body: JSON.stringify({ statusCode: 403, message: 'Verify your email address before signing in.' }),
          });
          return;
        }
        if (tenantMfaRequired && !credentials.mfaCode) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ statusCode: 401, message: 'Multi-factor code required.' }),
          });
          return;
        }
        if (credentials.tenantSlug === 'pending-tenant') {
          currentUser = { ...currentUser, tenantStatus: 'PENDING_REVIEW', permissions: [] };
        }
        data = { accessToken: 'e2e-access-token', user: currentUser };
      } else if (pathname.endsWith('/auth/email/verification/resend')) {
        data = { message: 'If this account requires email verification, instructions will be sent.' };
      } else if (pathname.endsWith('/auth/email/verify')) {
        data = { verified: true };
      } else if (pathname.endsWith('/platform/auth/login')) {
        const credentials = route.request().postDataJSON() as { mfaCode?: string };
        if (platformMfaChallengeRequired && !credentials.mfaCode) {
          await route.fulfill({
            status: 401,
            contentType: 'application/json',
            body: JSON.stringify({ statusCode: 401, message: 'Multi-factor code required.' }),
          });
          return;
        }
        data = credentials.mfaCode
          ? {
              accessToken: 'e2e-platform-token',
              platformAdmin: { name: 'Platform Owner', email: 'admin@example.com' },
            }
          : {
              mfaSetupRequired: true,
              setupToken: 'e2e-platform-setup-token',
              platformAdmin: { name: 'Platform Owner', email: 'admin@example.com' },
            };
      } else if (pathname.endsWith('/platform/auth/mfa/setup')) {
        data = {
          secret: 'JBSWY3DPEHPK3PXP',
          provisioningUri: 'otpauth://totp/SaaS%20POS:admin',
        };
      } else if (pathname.endsWith('/platform/auth/mfa/confirm')) {
        data = {
          accessToken: 'e2e-platform-token',
          platformAdmin: { name: 'Platform Owner', email: 'admin@example.com' },
          recoveryCodes: ['AABBCCDDEEFF001122', '112233445566778899'],
        };
      } else if (pathname.endsWith('/platform/auth/logout')) {
        data = { loggedOut: true };
      } else if (pathname.endsWith('/platform/tenants')) {
        const searchParams = new URL(route.request().url()).searchParams;
        const items = searchParams.has('status')
          ? []
          : [{ id: 'platform-tenant-1', name: 'Test Retail Store', slug: 'test-retail', status: 'ACTIVE' }];
        data = { items, total: items.length, page: 1, pageSize: 100 };
      } else if (pathname.endsWith('/platform/auth/invitation/accept')) {
        data = { accepted: true, email: 'invited-admin@example.com' };
      } else if (pathname === '/api/v1/platform/plans' && route.request().method() === 'GET') {
        data = [{
          id: 'plan-1',
          code: 'STARTER',
          name: 'Starter',
          isAvailable: true,
          versions: [{
            id: 'plan-version-1',
            version: 1,
            isActive: true,
            trialDays: 14,
            billingPeriodDays: 30,
            currency: 'USD',
            price: '19.99',
            entitlements: [{ key: 'pos', value: true }],
            _count: { subscriptions: 1 },
          }],
        }];
      } else if (pathname === '/api/v1/platform/plans/plan-1/versions') {
        data = { id: 'plan-version-2', version: 2, isActive: true };
      } else if (pathname === '/api/v1/platform/fiscalization' && route.request().method() === 'GET') {
        data = platformFiscalization;
      } else if (
        pathname.startsWith('/api/v1/platform/fiscalization/providers/') &&
        route.request().method() === 'PUT'
      ) {
        const jurisdiction = pathname.split('/').at(-1);
        const body = route.request().postDataJSON() as Record<string, unknown>;
        const provider = {
          id: `provider-${jurisdiction}`,
          jurisdiction,
          ...body,
          credentialsConfigured: Boolean(body.credentials),
          updatedAt: new Date().toISOString(),
        };
        platformFiscalization = {
          ...platformFiscalization,
          providers: [
            ...platformFiscalization.providers.filter((item) => item.jurisdiction !== jurisdiction),
            provider,
          ],
        };
        data = provider;
      } else if (
        pathname === '/api/v1/platform/fiscalization/addon-offer' &&
        route.request().method() === 'PUT'
      ) {
        const body = route.request().postDataJSON() as {
          isAvailable: boolean;
          monthlyPrice: string | null;
          annualPrice: string | null;
        };
        platformFiscalization = {
          ...platformFiscalization,
          addonOffer: {
            id: 'fiscalization',
            isTestOnly: true,
            currency: 'TZS',
            ...body,
          },
        };
        data = platformFiscalization.addonOffer;
      } else if (pathname === '/api/v1/platform/admins') {
        data = [{
          id: 'platform-admin-1',
          name: 'Platform Owner',
          email: 'admin@example.com',
          status: 'ACTIVE',
          mfaEnabled: true,
          createdAt: '2026-11-01T10:00:00.000Z',
        }];
      } else if (pathname === '/api/v1/platform/admins/invitations') {
        data = { invited: true };
      } else if (pathname === '/api/v1/platform/support-access' && route.request().method() === 'GET') {
        data = supportGrantCreated ? [{
          id: 'support-grant-1',
          tenant: { id: 'platform-tenant-1', name: 'Test Retail Store', slug: 'test-retail' },
          purpose: 'Support request follow-up',
          scopes: ['tenant_profile', 'stores'],
          expiresAt: '2026-11-03T11:00:00.000Z',
          createdAt: '2026-11-03T10:00:00.000Z',
          revokedAt: null,
          status: 'ACTIVE',
          events: [
            {
              id: 'support-event-1',
              supportAccessId: 'support-grant-1',
              actorPlatformAdminId: 'platform-admin-1',
              action: 'grant_created',
              scope: null,
              createdAt: '2026-11-03T10:00:00.000Z',
            },
            {
              id: 'support-event-2',
              supportAccessId: 'support-grant-1',
              actorPlatformAdminId: 'platform-admin-1',
              action: 'scoped_data_read',
              scope: 'tenant_profile',
              createdAt: '2026-11-03T10:05:00.000Z',
            },
          ],
        }] : [];
      } else if (pathname === '/api/v1/platform/support-access' && route.request().method() === 'POST') {
        supportGrantBody = route.request().postDataJSON() as Record<string, unknown>;
        supportGrantCreated = true;
        data = {
          id: 'support-grant-1',
          tenantId: 'platform-tenant-1',
          tenantName: 'Test Retail Store',
          purpose: supportGrantBody.purpose,
          scopes: supportGrantBody.scopes,
          expiresAt: '2026-11-03T11:00:00.000Z',
          createdAt: '2026-11-03T10:00:00.000Z',
          revokedAt: null,
          status: 'ACTIVE',
        };
      } else if (pathname === '/api/v1/platform/support-access/support-grant-1/tenant') {
        data = { id: 'platform-tenant-1', name: 'Test Retail Store', slug: 'test-retail', status: 'ACTIVE' };
      } else if (pathname === '/api/v1/platform/support-access/support-grant-1/stores') {
        data = [{ id: 'store-1', name: 'Main store', code: 'MAIN', status: 'ACTIVE', location: null }];
      } else if (pathname === '/api/v1/platform/support-access/support-grant-1/products') {
        data = { items: [], total: 0, limit: 100 };
      } else if (pathname === '/api/v1/platform/support-access/support-grant-1/sales-summary') {
        data = { allTime: { completedSales: 0, grossTotal: 0 }, last30Days: { completedSales: 0, grossTotal: 0 } };
      } else if (pathname.endsWith('/api/v1/auth/mfa/setup')) {
        data = {
          secret: 'JBSWY3DPEHPK3PXP',
          provisioningUri: 'otpauth://totp/SaaS%20POS:owner',
        };
      } else if (pathname.endsWith('/api/v1/auth/mfa/confirm')) {
        data = { recoveryCodes: ['AABBCCDDEEFF001122'] };
      } else if (pathname.endsWith('/api/v1/auth/mfa/disable')) {
        data = { disabled: true };
      } else if (pathname.endsWith('/tenant/onboarding/status')) {
        data = {
          name: 'Test Retail Store',
          slug: 'pending-tenant',
          status: 'PENDING_REVIEW',
          submittedAt: '2026-11-01T10:00:00.000Z',
          subscriptionStatus: 'TRIALING',
          rejectionReason: null,
          kybDocuments: [],
        };
      } else if (pathname.endsWith('/tenant/onboarding/kyb-documents')) {
        data = { id: 'e2e-kyb-document', reviewStatus: 'PENDING' };
      } else if (pathname.endsWith('/reports/sales-summary')) {
        data = {
          totalSales: 0,
          totalRevenue: '0.00',
          totalTax: '0.00',
          totalDiscount: '0.00',
          averageOrderValue: '0.00',
          byStore: [],
          byPaymentMethod: {},
          topProducts: [],
        };
      } else if (pathname.endsWith('/reports/inventory')) {
        data = {
          totalItems: 0,
          lowStockCount: 0,
          outOfStockCount: 0,
          lowStockItems: [],
          items: [],
        };
      } else if (pathname.endsWith('/products')) {
        data = { items: [], total: 0 };
      } else if (pathname.endsWith('/stores')) {
        data = { items: [], total: 0 };
      } else if (pathname.endsWith('/sales')) {
        data = { items: [], total: 0 };
      } else if (pathname.endsWith('/returns')) {
        data = { items: [], total: 0 };
      } else if (pathname.endsWith('/purchasing/suppliers') || pathname.endsWith('/purchasing/purchase-orders')) {
        data = { items: [], total: 0 };
      }

      await route.fulfill({
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': route.request().headers().origin ?? 'http://localhost:5173',
          'Access-Control-Allow-Credentials': 'true',
        },
        body: JSON.stringify({ success: true, data }),
      });
    });

    await page.goto('/');
  });

  test('should load the landing page', async ({ page }) => {
    await expect(page).toHaveTitle(/SaaS POS/);
    await expect(page.getByRole('heading', { name: /The Commerce Platform/i })).toBeVisible();
    expect(requestedPaths).not.toContain('/api/v1/platform/stats');
  });

  test('should open the platform review portal from the public landing page', async ({ page }) => {
    await page.getByRole('link', { name: 'Platform administration' }).first().click();
    await expect(page).toHaveURL('/platform/review');
    await expect(page.getByRole('heading', { name: 'Initialize platform' })).toBeVisible();

    await page.getByLabel('Platform name').fill('Test Platform');
    await page.getByLabel('Administrator name').fill('Platform Owner');
    await page.getByLabel('Administrator email').fill('admin@example.com');
    await page.getByLabel('Administrator password').fill('PlatformPassword123!');
    await page.getByLabel('Installation secret').fill('deployment-secret-value');
    const initializationRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/installation/initialize',
    );
    await page.getByRole('button', { name: 'Initialize platform' }).click();
    const request = await initializationRequest;
    expect(JSON.parse(request.postData() ?? '{}')).toEqual({
      platformName: 'Test Platform',
      adminName: 'Platform Owner',
      adminEmail: 'admin@example.com',
      password: 'PlatformPassword123!',
    });
    expect(request.headers()['x-installation-secret']).toBe('deployment-secret-value');
    await expect(page.getByRole('status')).toContainText('Platform initialized');
    await expect(page.getByLabel('Administrator email')).toHaveValue('admin@example.com');
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('should navigate to login page', async ({ page }) => {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/login');
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('should navigate to registration page', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: "Don't have an account? Register" }).click();
    await expect(page).toHaveURL('/register');
    await expect(page.getByRole('heading', { name: 'Register Tenant' })).toBeVisible();
  });

  test('should create and update tenant roles with assignable permissions', async ({ page }) => {
    authRestoreSuccess = true;
    currentUser = {
      ...currentUser,
      permissions: [...(currentUser.permissions as string[]), 'products.create'],
    };
    await page.goto('/app/roles');
    await expect(page.getByRole('heading', { name: 'Roles & permissions' })).toBeVisible();
    await expect(page.getByText('Tenant Owner', { exact: true })).toBeVisible();

    await page.getByLabel('Role name').fill('Temporary Clerk');
    await page.getByLabel('Description').fill('Limited product access');
    await page.getByLabel(/products\.view/).check();
    await page.getByLabel(/products\.create/).check();
    const createRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/tenant/roles',
    );
    await page.getByRole('button', { name: 'Create role' }).click();
    expect((await createRequest).postDataJSON()).toEqual({
      name: 'Temporary Clerk',
      description: 'Limited product access',
      permissionCodes: ['products.view', 'products.create'],
    });
    await expect(page.getByText('Role created.')).toBeVisible();

    const clerkCard = page.locator('article').filter({ hasText: 'Temporary Clerk' });
    await clerkCard.getByRole('button', { name: 'Edit role' }).click();
    await page.getByRole('checkbox', { name: /products\.create/ }).last().uncheck();
    const updateRequest = page.waitForRequest((request) =>
      request.method() === 'PATCH' &&
      new URL(request.url()).pathname === '/api/v1/tenant/roles/tenant-custom-role',
    );
    await page.getByRole('button', { name: 'Save changes' }).click();
    expect((await updateRequest).postDataJSON()).toEqual({
      name: 'Temporary Clerk',
      description: 'Limited product access',
      permissionCodes: ['products.view'],
    });
    await expect(page.getByText('Role updated.')).toBeVisible();
  });

  test('should update business profile without enabling unapproved tax or receipt settings', async ({ page }) => {
    authRestoreSuccess = true;
    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: 'Business settings' })).toBeVisible();
    await expect(page.getByText('Disabled pending Tanzania tax/legal review; prices remain tax-exclusive.')).toBeVisible();
    await expect(page.getByText('Statutory receipt preferences: pending legal review.')).toBeVisible();

    await page.getByLabel('Business name').fill('Test Retail Store Updated');
    await page.getByLabel('Business address').fill('123 Market Street, Dar es Salaam');
    await page.getByLabel('Business contact email').fill('contact@example.com');
    await page.getByLabel('Business contact phone').fill('+255 712 345 678');
    const updateRequest = page.waitForRequest((request) =>
      request.method() === 'PATCH' &&
      new URL(request.url()).pathname === '/api/v1/tenant/settings',
    );
    await page.getByRole('button', { name: 'Save business profile' }).click();
    expect((await updateRequest).postDataJSON()).toEqual({
      name: 'Test Retail Store Updated',
      businessAddress: '123 Market Street, Dar es Salaam',
      contactEmail: 'contact@example.com',
      contactPhone: '+255 712 345 678',
    });
    await expect(page.getByText('Business profile saved.')).toBeVisible();
    await expect(page.locator('header.topbar').getByText('Test Retail Store Updated')).toBeVisible();
    expect(requestedPaths).toContain('/api/v1/tenant/settings');
  });

  test('should save fiscal setup as configuration-only with tax and fiscal receipts disabled', async ({ page }) => {
    authRestoreSuccess = true;
    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: 'Fiscal integration setup' })).toBeVisible();
    await expect(page.getByText(/Tax calculation, sale completion as a fiscal sale/)).toBeVisible();

    await page.getByLabel('Registered legal name').first().fill('Test Retail Limited');
    const profileRequest = page.waitForRequest((request) =>
      request.method() === 'PATCH' &&
      new URL(request.url()).pathname === '/api/v1/tenant/fiscalization/profiles/MAINLAND_TANZANIA',
    );
    await page.getByRole('button', { name: 'Save Tanzania Mainland configuration' }).click();
    expect((await profileRequest).postDataJSON()).toEqual({
      legalName: 'Test Retail Limited',
      taxIdentificationNumber: null,
      vatRegistrationNumber: null,
      providerConfigurationId: null,
      clearCredentials: false,
    });
    await expect(page.getByText('Fiscal profile saved in configuration-only mode.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Request add-on information' })).toHaveCount(0);
    expect(requestedPaths).toContain('/api/v1/tenant/fiscalization');
  });

  test('should label simulator output as non-official and only call the simulator endpoint', async ({ page }) => {
    authRestoreSuccess = true;
    fiscalSettings.simulator.enabled = true;
    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: 'Development fiscal simulator' })).toBeVisible();
    await expect(page.getByText('SIMULATED — NOT AN OFFICIAL FISCAL RECEIPT').first()).toBeVisible();

    const simulationRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/tenant/fiscalization/simulator/run',
    );
    await page.getByRole('button', { name: 'Run development simulation' }).click();
    expect((await simulationRequest).postDataJSON()).toEqual({
      jurisdiction: 'MAINLAND_TANZANIA',
      scenario: 'ACCEPTED',
    });
    await expect(page.getByRole('status')).toContainText('SIMULATED_ACCEPTED');
    await expect(page.getByRole('status')).toContainText('NOT AN OFFICIAL FISCAL RECEIPT');
    expect(requestedPaths).toContain('/api/v1/tenant/fiscalization/simulator/run');
    expect(requestedPaths.some((path) => path.startsWith('/api/v1/sales'))).toBe(false);
  });

  test('should run fiscal add-on checkout only as an unmistakably simulated test payment', async ({ page }) => {
    authRestoreSuccess = true;
    fiscalSettings.testBillingEnabled = true;
    fiscalSettings.addonOffer = {
      isAvailable: true,
      isTestOnly: true,
      currency: 'TZS',
      monthlyPrice: '35000',
      annualPrice: '400000',
    };
    await page.goto('/app/settings');
    await expect(page.getByRole('heading', { name: 'Fiscalization add-on · TEST OFFER' }).first()).toBeVisible();
    await expect(page.getByText(/TEST BILLING ONLY — no real payment/).first()).toBeVisible();
    const checkoutRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/tenant/fiscalization/addon-subscriptions/checkout',
    );
    await page.getByRole('button', { name: 'Start test checkout' }).first().click();
    expect((await checkoutRequest).postDataJSON()).toEqual({
      jurisdiction: 'MAINLAND_TANZANIA',
      billingPeriod: 'MONTHLY',
    });
    await expect(page.getByRole('status').filter({ hasText: 'Current test invoice' }).first()).toContainText('35000 TZS');
    const paymentRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith('/test-invoice-e2e/simulate-payment'),
    );
    await page.getByRole('button', { name: 'Simulate paid' }).first().click();
    expect((await paymentRequest).postDataJSON()).toMatchObject({
      outcome: 'PAID',
      idempotencyKey: expect.any(String),
    });
    await expect(page.getByText('TEST PAYMENT PAID — NO REAL CHARGE').first()).toBeVisible();
    expect(requestedPaths.some((path) => path.includes('/platform/payment-providers'))).toBe(false);
    expect(requestedPaths.some((path) => path.startsWith('/api/v1/sales'))).toBe(false);
  });

  test('should show that a new tenant is pending platform review', async ({ page }) => {
    await page.goto('/register');
    const registrationRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/auth/register',
    );

    // Fill in the registration form
    await page.getByLabel('Tenant Name').fill('Test Retail Store');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Owner Name').fill('Test Owner');
    await page.getByLabel('Owner Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');

    // Submit the form
    await page.getByRole('button', { name: 'Register' }).click();
    const request = await registrationRequest;
    expect(JSON.parse(request.postData() ?? '{}')).toEqual({
      tenantName: 'Test Retail Store',
      tenantSlug: 'test-retail',
      businessType: 'RETAIL',
      ownerName: 'Test Owner',
      ownerEmail: 'owner@example.com',
      password: 'SecurePassword123!',
      planCode: 'STARTER',
    });

    await expect(page).toHaveURL('/register');
    await expect(page.getByRole('heading', { name: 'Registration submitted' })).toBeVisible();
    await expect(page.getByText(/pending platform review/i)).toBeVisible();
    await expect(page.getByRole('link', { name: 'Go to sign in' })).toHaveAttribute('href', '/login');
  });

  test('should prevent invalid registration fields and show API field errors', async ({ page }) => {
    await page.goto('/register');
    await page.getByLabel('Tenant Name').fill('Fezra Stores');
    await page.getByLabel('Tenant Slug').fill('Fezra-Stores');
    await page.getByLabel('Owner Name').fill('Fezra Steven');
    await page.getByLabel('Owner Email').fill('fezra@example.com');
    await page.getByLabel('Password').fill('fezra@12345');
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByLabel('Password')).toHaveAttribute('minlength', '12');
    expect(requestedPaths).not.toContain('/api/v1/auth/register');
    expect(await page.getByLabel('Password').evaluate((input: HTMLInputElement) => input.validity.valid)).toBe(false);

    registrationFailure = true;
    await page.getByLabel('Password').fill('FezraPassword123!');
    await page.getByRole('button', { name: 'Register' }).click();

    await expect(page.getByRole('alert').filter({ hasText: /correct the highlighted fields/i })).toBeVisible();
    await expect(page.getByText(/length must be at least 12 characters/i)).toBeVisible();
    await expect(page.getByLabel('Tenant Slug')).toHaveValue('fezra-stores');
  });

  test('should login with existing credentials', async ({ page }) => {
    await page.goto('/login');

    // Fill in login form
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');

    // Submit the form
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Should redirect to dashboard after successful login
    await expect(page).toHaveURL('/app/dashboard');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('should navigate to products page from dashboard', async ({ page }) => {
    // First login
    await page.goto('/login');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/app/dashboard');

    // Navigate to products
    await page.getByRole('link', { name: 'Products' }).click();
    await expect(page).toHaveURL('/app/products');
    await expect(page.getByRole('heading', { name: 'Product Catalogue' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Add Product' })).toBeHidden();
  });

  test('should hide create actions and unnecessary lookups from view-only users', async ({ page }) => {
    currentUser.permissions = [
      'reports.view',
      'stores.view',
      'products.view',
      'inventory.view',
      'sales.view',
      'purchases.view',
    ];
    await page.goto('/login');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/app/dashboard');

    await page.getByRole('link', { name: 'Sales' }).click();
    await expect(page.getByRole('heading', { name: 'POS Sales' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'New Sale' })).toBeHidden();
    await expect(page.getByRole('link', { name: 'Returns' })).toBeHidden();

    requestedPaths = [];
    await page.getByRole('link', { name: 'Purchasing' }).click();
    await expect(page.getByRole('heading', { name: 'Purchasing', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Create Purchase Order' })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Supplier', exact: true })).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Goods Receipt (Receive Inventory)' })).toBeHidden();
    expect(requestedPaths).not.toContain('/api/v1/products');
    expect(requestedPaths).not.toContain('/api/v1/stores');
  });

  test('should navigate to stores and inventory for authorized tenant users', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/app/dashboard');

    await page.getByRole('link', { name: 'Stores' }).click();
    await expect(page).toHaveURL('/app/stores');
    await expect(page.getByRole('heading', { name: 'Stores', exact: true })).toBeVisible();

    await page.getByRole('link', { name: 'Inventory' }).click();
    await expect(page).toHaveURL('/app/inventory');
    await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible();
  });

  test('should preserve a tenant session through a temporary session-restore failure', async ({ page }) => {
    authRestoreFailure = 503;
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Session could not be restored' })).toBeVisible();
    expect(await page.evaluate(() => localStorage.getItem('token'))).toBeNull();

    authRestoreFailure = null;
    authRestoreSuccess = true;
    await page.getByRole('button', { name: 'Try again' }).click();
    await expect(page.getByRole('heading', { name: /The Commerce Platform/ })).toBeVisible();
    await page.goto('/app/dashboard');
    await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  });

  test('should complete email verification from a one-time email link', async ({ page }) => {
    const verificationRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/auth/email/verify',
    );
    await page.goto('/verify-email?token=email-verification-token-value');
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible();
    expect((await verificationRequest).postDataJSON()).toEqual({ token: 'email-verification-token-value' });
    await page.getByRole('link', { name: 'Continue to sign in' }).click();
    await expect(page).toHaveURL('/login');
  });

  test('should resend verification instructions when login requires verified email', async ({ page }) => {
    emailVerificationRequired = true;
    await page.goto('/login');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('button', { name: 'Resend verification email' })).toBeVisible();

    const resendRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/auth/email/verification/resend',
    );
    await page.getByRole('button', { name: 'Resend verification email' }).click();
    expect((await resendRequest).postDataJSON()).toEqual({ email: 'owner@example.com' });
    await expect(page.getByRole('status')).toContainText('If this account requires email verification');
  });

  test('should prompt for tenant MFA after password authentication', async ({ page }) => {
    tenantMfaRequired = true;
    await page.goto('/login');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByLabel('Authenticator or recovery code')).toBeVisible();
    await page.getByLabel('Authenticator or recovery code').fill('123456');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/app/dashboard');
  });

  test('should set up, recover, and disable tenant MFA from account security', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Tenant Slug').fill('test-retail');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL('/app/dashboard');
    await page.getByRole('link', { name: 'Security' }).click();
    await expect(page.getByRole('heading', { name: 'Security' })).toBeVisible();
    await page.getByRole('button', { name: 'Set up MFA' }).click();
    await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();

    await page.getByLabel('Authenticator code').fill('123456');
    const confirmRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/auth/mfa/confirm',
    );
    await page.getByRole('button', { name: 'Verify and enable MFA' }).click();
    expect((await confirmRequest).postDataJSON()).toEqual({ code: '123456' });
    await expect(page.getByText('Multi-factor authentication is enabled.')).toBeVisible();
    await expect(page.getByText('AABBCCDDEEFF001122')).toBeVisible();
    await page.getByRole('button', { name: 'I have saved these codes' }).click();

    await page.getByLabel('Authenticator or recovery code').fill('123456');
    const disableRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/auth/mfa/disable',
    );
    await page.getByRole('button', { name: 'Disable MFA' }).click();
    expect((await disableRequest).postDataJSON()).toEqual({ code: '123456' });
    await expect(page.getByText('Multi-factor authentication is disabled.')).toBeVisible();
  });

  test('should enroll platform MFA before granting access to the review portal', async ({ page }) => {
    platformInitialized = true;
    await page.goto('/platform/review');
    await expect(page.getByRole('heading', { name: 'Platform administration' })).toBeVisible();
    await page.getByLabel('Administrator email').fill('admin@example.com');
    await page.getByLabel('Password').fill('PlatformPassword123!');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();

    await expect(page.getByRole('heading', { name: 'Set up required multi-factor authentication' })).toBeVisible();
    await expect(page.getByText('JBSWY3DPEHPK3PXP')).toBeVisible();
    await page.getByLabel('Authenticator code').fill('123456');
    await page.getByRole('button', { name: 'Verify and finish setup' }).click();

    await expect(page.getByRole('heading', { name: 'Tenant review queue' })).toBeVisible();
    await expect(page.getByText('AABBCCDDEEFF001122')).toBeVisible();
    await page.getByRole('button', { name: 'I have saved these codes' }).click();
    await expect(page.getByText('AABBCCDDEEFF001122')).toBeHidden();
  });

  test('should require a platform MFA challenge on subsequent sign-ins', async ({ page }) => {
    platformInitialized = true;
    platformMfaChallengeRequired = true;
    await page.goto('/platform/review');
    await page.getByLabel('Administrator email').fill('admin@example.com');
    await page.getByLabel('Password').fill('PlatformPassword123!');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();
    await expect(page.getByLabel('Authenticator or recovery code')).toBeVisible();
    await page.getByLabel('Authenticator or recovery code').fill('123456');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();
    await expect(page.getByRole('heading', { name: 'Tenant review queue' })).toBeVisible();
  });

  test('should create an immutable plan version through platform management', async ({ page }) => {
    platformInitialized = true;
    platformMfaChallengeRequired = true;
    await page.goto('/platform/review');
    await page.getByLabel('Administrator email').fill('admin@example.com');
    await page.getByLabel('Password').fill('PlatformPassword123!');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();
    await page.getByLabel('Authenticator or recovery code').fill('123456');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();
    await expect(page.getByRole('heading', { name: 'Tenant review queue' })).toBeVisible();
    await page.getByRole('button', { name: 'Management' }).click();
    await page.getByRole('button', { name: 'Create version' }).click();
    await expect(page.getByRole('heading', { name: 'Create a new plan version' })).toBeVisible();

    const versionRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/platform/plans/plan-1/versions',
    );
    await page.getByRole('button', { name: 'Create version' }).last().click();
    expect((await versionRequest).postDataJSON()).toEqual(expect.objectContaining({
      trialDays: 14,
      billingPeriodDays: 30,
      currency: 'USD',
      price: '0',
      entitlements: expect.objectContaining({ pos: true, products: true }),
    }));
    await expect(page.getByText('New plan version created. Previous versions remain assigned to existing tenants.')).toBeVisible();
  });

  test('should configure fiscal provider metadata and the test-only billing offer', async ({ page }) => {
    platformInitialized = true;
    platformMfaChallengeRequired = true;
    platformFiscalization.testBillingEnabled = true;
    await page.goto('/platform/review');
    await page.getByLabel('Administrator email').fill('admin@example.com');
    await page.getByLabel('Password').fill('PlatformPassword123!');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();
    await page.getByLabel('Authenticator or recovery code').fill('123456');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();
    await page.getByRole('button', { name: 'Management' }).click();
    await page.getByRole('button', { name: 'Fiscal setup' }).click();
    await expect(page.getByRole('heading', { name: 'Fiscal provider and add-on setup' })).toBeVisible();

    await page.getByLabel('Provider name').first().fill('Mainland test provider');
    await page.getByLabel('Production endpoint (HTTPS)').first().fill('https://fiscal.example.test/api');
    await page.getByLabel('Approval evidence status').first().selectOption('AUTHORITY_APPROVED');
    await page.getByLabel('Approval evidence reference').first().fill('approval-reference-test-1');
    await page.getByLabel('Make provider available for tenant configuration').first().check();
    const providerRequest = page.waitForRequest((request) =>
      request.method() === 'PUT' &&
      new URL(request.url()).pathname === '/api/v1/platform/fiscalization/providers/MAINLAND_TANZANIA',
    );
    await page.getByRole('button', { name: 'Save provider configuration' }).first().click();
    expect((await providerRequest).postDataJSON()).toEqual({
      providerName: 'Mainland test provider',
      productionEndpoint: 'https://fiscal.example.test/api',
      sandboxEndpoint: null,
      documentationUrl: null,
      approvalStatus: 'AUTHORITY_APPROVED',
      approvalEvidenceReference: 'approval-reference-test-1',
      isAvailable: true,
      clearCredentials: false,
    });

    await page.getByLabel('Test monthly price (TZS)').fill('35000');
    await page.getByRole('checkbox', { name: 'Publish test offer to development/test tenants' }).check();
    const offerRequest = page.waitForRequest((request) =>
      request.method() === 'PUT' &&
      new URL(request.url()).pathname === '/api/v1/platform/fiscalization/addon-offer',
    );
    await page.getByRole('button', { name: 'Save test offer' }).click();
    expect((await offerRequest).postDataJSON()).toEqual({
      isAvailable: true,
      monthlyPrice: '35000',
      annualPrice: null,
    });
    await expect(page.getByText('Fiscal add-on offer configuration saved.')).toBeVisible();
    expect(requestedPaths).toContain('/api/v1/platform/fiscalization');
  });

  test('should grant and use tenant-scoped read-only support access', async ({ page }) => {
    platformInitialized = true;
    platformMfaChallengeRequired = true;
    await page.goto('/platform/review');
    await page.getByLabel('Administrator email').fill('admin@example.com');
    await page.getByLabel('Password').fill('PlatformPassword123!');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();
    await page.getByLabel('Authenticator or recovery code').fill('123456');
    await page.getByRole('button', { name: 'Sign in to platform' }).click();
    await page.getByRole('button', { name: 'Management' }).click();
    await page.getByRole('button', { name: 'Support access' }).click();

    await page.getByRole('combobox', { name: 'Tenant' }).selectOption('platform-tenant-1');
    await page.getByLabel('Purpose and support case reference').fill('Support case 12345: verify store setup');
    await page.getByLabel('Stores', { exact: false }).check();
    const grantRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/platform/support-access',
    );
    await page.getByRole('button', { name: 'Grant support access' }).click();
    const requestBody = (await grantRequest).postDataJSON() as {
      tenantId: string;
      purpose: string;
      scopes: string[];
      durationMinutes: number;
    };
    expect(requestBody).toEqual({
      tenantId: 'platform-tenant-1',
      purpose: 'Support case 12345: verify store setup',
      scopes: ['tenant_profile', 'stores'],
      durationMinutes: 30,
    });

    await page.getByRole('button', { name: 'View scoped data' }).click();
    await expect(page.getByRole('heading', { name: 'Read-only data: Test Retail Store' })).toBeVisible();
    await expect(page.getByText('Immutable access history (2)')).toBeVisible();
    await expect(page.getByText('"name": "Main store"')).toBeVisible();
    expect(requestedPaths).toContain('/api/v1/platform/support-access/support-grant-1/tenant');
    expect(requestedPaths).toContain('/api/v1/platform/support-access/support-grant-1/stores');
    expect(requestedPaths).not.toContain('/api/v1/platform/support-access/support-grant-1/products');
  });

  test('should accept a one-time platform administrator invitation', async ({ page }) => {
    await page.goto('/platform/accept-invitation?token=valid-invitation-token');
    await page.getByLabel('Password', { exact: true }).fill('InvitedAdminPassword123!');
    await page.getByLabel('Confirm password').fill('DifferentAdminPassword123!');
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(page.getByRole('alert')).toContainText('passwords do not match');
    expect(requestedPaths).not.toContain('/api/v1/platform/auth/invitation/accept');

    await page.getByLabel('Confirm password').fill('InvitedAdminPassword123!');
    const acceptanceRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/platform/auth/invitation/accept',
    );
    await page.getByRole('button', { name: 'Accept invitation' }).click();
    expect((await acceptanceRequest).postDataJSON()).toEqual({
      token: 'valid-invitation-token',
      password: 'InvitedAdminPassword123!',
    });
    await expect(page.getByRole('status')).toContainText('Invitation accepted');
  });

  test('should restrict a pending owner to KYB onboarding', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Tenant Slug').fill('pending-tenant');
    await page.getByLabel('Email').fill('owner@example.com');
    await page.getByLabel('Password').fill('SecurePassword123!');
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL('/app/onboarding');
    await expect(page.getByRole('heading', { name: 'Application review' })).toBeVisible();
    await expect(page.getByText('Pending review', { exact: false })).toBeVisible();
    await page.getByLabel('Document name').fill('Business registration');
    await page.getByLabel('Document file').setInputFiles({
      name: 'registration.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.4\\n%%EOF'),
    });

    const uploadRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/tenant/onboarding/kyb-documents',
    );
    await page.getByRole('button', { name: 'Upload document' }).click();
    const request = await uploadRequest;
    expect(request.headers()['content-type']).toContain('multipart/form-data');
    await expect(page.getByRole('status')).toContainText('Document uploaded');
  });

  test('should request a password reset without revealing account existence', async ({ page }) => {
    await page.goto('/login');
    await page.getByRole('link', { name: 'Forgot password?' }).click();
    await expect(page).toHaveURL('/forgot-password');
    await page.getByLabel('Email').fill('owner@example.com');

    const resetRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/auth/password/forgot',
    );
    await page.getByRole('button', { name: 'Send reset link' }).click();
    const request = await resetRequest;
    expect(request.postDataJSON()).toEqual({ email: 'owner@example.com' });
    await expect(page.getByRole('status')).toContainText('If an account exists');
  });

  test('should consume a reset link and clear its token from browser history', async ({ page }) => {
    await page.goto('/reset-password?token=short-lived-reset-token');
    await expect(page).toHaveURL('/reset-password');
    await page.getByLabel('New password', { exact: true }).fill('NewSecurePassword123!');
    await page.getByLabel('Confirm new password', { exact: true }).fill('NewSecurePassword123!');

    const resetRequest = page.waitForRequest((request) =>
      request.method() === 'POST' &&
      new URL(request.url()).pathname === '/api/v1/auth/password/reset',
    );
    await page.getByRole('button', { name: 'Reset password' }).click();
    const request = await resetRequest;
    expect(request.postDataJSON()).toEqual({
      token: 'short-lived-reset-token',
      password: 'NewSecurePassword123!',
    });
    await expect(page.getByRole('status')).toContainText('Your password has been reset');
  });
});
