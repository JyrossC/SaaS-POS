import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import { assertDedicatedTestDatabase } from './testing/test-database';
import { AuthService } from './auth/auth.service';
import { EmailService } from './email/email.service';

describe('API HTTP integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let authService: AuthService;
  let baseUrl: string;
  let tenantSlug = '';
  let flowTenantSlug = '';
  let flowOwnerEmail = '';
  let deactivatedStaffEmail = '';
  let flowTenantId = '';
  let secondaryTenantId = '';
  let secondaryMembershipId = '';
  let secondaryStaffSessionId = '';
  let platformAdminId = '';
  let platformInvitedAdminEmail = '';
  let platformTestPlanId = '';
  let rejectedTenantSlug = '';
  let rejectedOwnerEmail = '';
  let kybStoragePath = '';
  const previousKybStoragePath = process.env.PRIVATE_STORAGE_PATH;
  const previousFiscalEncryptionKey = process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY;
  const emailDelivery = {
    sendPasswordReset: jest.fn().mockResolvedValue(undefined),
    sendEmailVerification: jest.fn().mockResolvedValue(undefined),
    sendPlatformAdminInvitation: jest.fn().mockResolvedValue(undefined),
  };

  function getCookie(response: Response, name: string): string {
    const cookie = response.headers.get('set-cookie')?.split(';', 1)[0];
    if (!cookie?.startsWith(`${name}=`)) {
      throw new Error(`The response did not set the ${name} cookie.`);
    }
    return cookie;
  }

  function createTotpCode(secret: string, timestamp = Date.now()): string {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    let bits = 0;
    let value = 0;
    const bytes: number[] = [];
    for (const character of secret) {
      value = (value << 5) | alphabet.indexOf(character);
      bits += 5;
      if (bits >= 8) {
        bytes.push((value >>> (bits - 8)) & 255);
        bits -= 8;
      }
    }
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(Math.floor(timestamp / 30_000)));
    const digest = createHmac('sha1', Buffer.from(bytes)).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    return String(binary % 1_000_000).padStart(6, '0');
  }

  beforeAll(async () => {
    assertDedicatedTestDatabase();
    kybStoragePath = await mkdtemp(join(tmpdir(), 'saas-pos-api-e2e-kyb-'));
    process.env.PRIVATE_STORAGE_PATH = kybStoragePath;
    process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 19).toString('base64');

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(EmailService)
      .useValue(emailDelivery)
      .compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = module.get(PrismaService);
    authService = module.get(AuthService);

    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('The API test server did not bind to a TCP port.');
    }

    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    if (prisma && secondaryTenantId) {
      await prisma.$transaction(async (tx) => {
        if (secondaryStaffSessionId) {
          await tx.authSession.deleteMany({ where: { id: secondaryStaffSessionId } });
        }
        if (secondaryMembershipId) {
          await tx.membership.deleteMany({ where: { id: secondaryMembershipId } });
        }
        await tx.role.deleteMany({ where: { tenantId: secondaryTenantId } });
        await tx.tenant.deleteMany({ where: { id: secondaryTenantId } });
      });
    }

    if (prisma) {
      for (const slug of [tenantSlug, rejectedTenantSlug].filter(
        (value): value is string => Boolean(value),
      )) {
        const auditLog = await prisma.auditLog.findFirst({
          where: {
            action: 'auth.login_failed',
            resource: 'authentication',
            metadata: { path: ['tenantSlug'], equals: slug },
          },
          select: { id: true },
        });
        if (auditLog) {
          await prisma.auditLog.delete({ where: { id: auditLog.id } });
        }
      }
    }

    if (prisma) {
      for (const registration of [
        { slug: flowTenantSlug, email: flowOwnerEmail },
        { slug: rejectedTenantSlug, email: rejectedOwnerEmail },
      ]) {
        if (!registration.slug || !registration.email) {
          continue;
        }
        const tenant = await prisma.tenant.findUnique({
          where: { slug: registration.slug },
          select: { id: true },
        });
        if (!tenant) {
          continue;
        }
        await prisma.$transaction(async (tx) => {
          const roles = await tx.role.findMany({
            where: { tenantId: tenant.id },
            select: { id: true },
          });
          const roleIds = roles.map(({ id }) => id);

          await tx.auditLog.deleteMany({ where: { tenantId: tenant.id } });
          await tx.platformSupportAccess.deleteMany({ where: { tenantId: tenant.id } });
          await tx.tenantKybDocument.deleteMany({ where: { tenantId: tenant.id } });
          await tx.platformAuditLog.deleteMany({ where: { resourceId: tenant.id } });
          await tx.membershipRole.deleteMany({ where: { tenantId: tenant.id } });
          await tx.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
          await tx.product.deleteMany({ where: { tenantId: tenant.id } });
          await tx.subscriptionPayment.deleteMany({ where: { invoice: { tenantId: tenant.id } } });
          await tx.subscriptionInvoice.deleteMany({ where: { tenantId: tenant.id } });
          await tx.fiscalAddonSubscription.deleteMany({ where: { tenantId: tenant.id } });
          await tx.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
          await tx.tenantModuleSetting.deleteMany({ where: { tenantId: tenant.id } });
          await tx.membership.deleteMany({ where: { tenantId: tenant.id } });
          await tx.role.deleteMany({ where: { tenantId: tenant.id } });
          await tx.tenant.delete({ where: { id: tenant.id } });
          await tx.user.deleteMany({ where: { email: registration.email } });
          if (deactivatedStaffEmail && registration.slug === flowTenantSlug) {
            await tx.user.deleteMany({ where: { email: deactivatedStaffEmail } });
          }
        });
      }
    }

    if (platformAdminId && prisma) {
      await prisma.platformAdminInvitation.deleteMany({
        where: { createdByPlatformAdminId: platformAdminId },
      });
      await prisma.platformAuditLog.deleteMany({
        where: { actorPlatformAdminId: platformAdminId },
      });
      if (platformInvitedAdminEmail) {
        await prisma.platformAdmin.deleteMany({ where: { email: platformInvitedAdminEmail } });
      }
      await prisma.platformAdmin.delete({ where: { id: platformAdminId } });
    }
    if (platformTestPlanId && prisma) {
      await prisma.planEntitlement.deleteMany({
        where: { planVersion: { planId: platformTestPlanId } },
      });
      await prisma.subscriptionPlanVersion.deleteMany({ where: { planId: platformTestPlanId } });
      await prisma.subscriptionPlan.delete({ where: { id: platformTestPlanId } });
    }

    if (app) {
      await app.close();
    }
    if (kybStoragePath) {
      await rm(kybStoragePath, { recursive: true, force: true });
    }
    if (previousKybStoragePath === undefined) {
      delete process.env.PRIVATE_STORAGE_PATH;
    } else {
      process.env.PRIVATE_STORAGE_PATH = previousKybStoragePath;
    }
    if (previousFiscalEncryptionKey === undefined) {
      delete process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY = previousFiscalEncryptionKey;
    }
  });

  it('handles a failed login over HTTP and persists its audit event', async () => {
    tenantSlug = `http-e2e-${process.pid}-${Date.now()}`;
    const password = 'NotAValidAccount123!';
    const response = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: `${tenantSlug}@example.com`,
        tenantSlug,
        password,
      }),
    });

    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual(
      expect.objectContaining({
        statusCode: 401,
        message: 'Invalid email, password, or tenant.',
      }),
    );
    expect(JSON.stringify(body)).not.toContain(password);

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        action: 'auth.login_failed',
        resource: 'authentication',
        metadata: { path: ['tenantSlug'], equals: tenantSlug },
      },
    });
    expect(auditLog).not.toBeNull();

    const unknownAccountReset = await fetch(`${baseUrl}/auth/password/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: `${tenantSlug}@example.com` }),
    });
    expect(unknownAccountReset.status).toBe(200);
    expect(await unknownAccountReset.json()).toEqual({
      message: 'If an account exists for this address, password reset instructions will be sent.',
    });
    expect(emailDelivery.sendPasswordReset).toHaveBeenLastCalledWith(
      `${tenantSlug}@example.com`,
      undefined,
    );
  });

  it('keeps new tenants pending until HTTP platform approval, then permits owner operations', async () => {
    flowTenantSlug = `http-flow-${process.pid}-${Date.now()}`;
    flowOwnerEmail = `${flowTenantSlug}@example.com`;
    const registration = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantName: 'HTTP Integration Store',
        tenantSlug: flowTenantSlug,
        businessType: 'RETAIL',
        ownerName: 'HTTP Integration Owner',
        ownerEmail: flowOwnerEmail,
        password: 'HttpIntegrationPassword123!',
        planCode: 'STARTER',
      }),
    });

    expect(registration.status).toBe(201);
    const registrationBody = (await registration.json()) as {
      status?: string;
      message?: string;
      accessToken?: string;
    };
    expect(registrationBody).toEqual({
      status: 'PENDING_REVIEW',
      message: 'Registration submitted. Verify your email address to access the onboarding portal.',
    });
    expect(registrationBody).not.toHaveProperty('accessToken');

    const pendingTenant = await prisma.tenant.findUnique({
      where: { slug: flowTenantSlug },
      include: {
        subscription: { select: { status: true } },
        memberships: {
          include: { user: { select: { email: true } } },
        },
      },
    });
    expect(pendingTenant).toEqual(
      expect.objectContaining({
        status: 'PENDING_REVIEW',
        subscription: expect.objectContaining({ status: 'TRIALING' }),
        memberships: [
          expect.objectContaining({
            status: 'ACTIVE',
            user: expect.objectContaining({ email: flowOwnerEmail }),
          }),
        ],
      }),
    );
    if (!pendingTenant) {
      throw new Error('Tenant registration did not persist a pending tenant.');
    }
    flowTenantId = pendingTenant.id;
    tenantSlug = flowTenantSlug;

    const verificationToken = emailDelivery.sendEmailVerification.mock.calls.at(-1)?.[1] as string;
    expect(verificationToken).toEqual(expect.any(String));
    const emailVerification = await fetch(`${baseUrl}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: verificationToken }),
    });
    expect(emailVerification.status).toBe(200);
    expect(await emailVerification.json()).toEqual({ verified: true });

    const pendingOwnerLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: flowOwnerEmail,
        tenantSlug: flowTenantSlug,
        password: 'HttpIntegrationPassword123!',
      }),
    });
    expect(pendingOwnerLogin.status).toBe(200);
    const pendingOwnerLoginBody = (await pendingOwnerLogin.json()) as {
      accessToken?: string;
      user?: { tenantStatus: string; permissions: string[] };
    };
    let pendingOwnerToken = pendingOwnerLoginBody.accessToken;
    if (!pendingOwnerToken) {
      throw new Error('Pending tenant owner login did not return a restricted session.');
    }
    expect(pendingOwnerLoginBody.user).toEqual(
      expect.objectContaining({ tenantStatus: 'PENDING_REVIEW', permissions: [] }),
    );
    const pendingOwnerRefreshCookie = getCookie(pendingOwnerLogin, 'spos_tenant_refresh');
    expect(pendingOwnerLogin.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(pendingOwnerLogin.headers.get('set-cookie')).toMatch(/Path=\/api\/v1\/auth/i);

    const rejectedTenantRefreshOrigin = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: pendingOwnerRefreshCookie,
        Origin: 'https://attacker.example',
      },
    });
    expect(rejectedTenantRefreshOrigin.status).toBe(403);

    const tenantRefresh = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: pendingOwnerRefreshCookie,
        Origin: 'http://localhost:5173',
      },
    });
    expect(tenantRefresh.status).toBe(200);
    const refreshedTenantSession = (await tenantRefresh.json()) as {
      accessToken?: string;
      user?: { tenantStatus: string };
    };
    if (!refreshedTenantSession.accessToken) {
      throw new Error('Tenant refresh did not rotate the session.');
    }
    pendingOwnerToken = refreshedTenantSession.accessToken;
    const rotatedTenantRefreshCookie = getCookie(tenantRefresh, 'spos_tenant_refresh');
    expect(rotatedTenantRefreshCookie).not.toBe(pendingOwnerRefreshCookie);

    const pendingProducts = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${pendingOwnerToken}` },
    });
    expect(pendingProducts.status).toBe(403);

    const pendingStatus = await fetch(`${baseUrl}/tenant/onboarding/status`, {
      headers: { Authorization: `Bearer ${pendingOwnerToken}` },
    });
    expect(pendingStatus.status).toBe(200);
    expect(await pendingStatus.json()).toEqual(
      expect.objectContaining({
        name: 'HTTP Integration Store',
        slug: flowTenantSlug,
        status: 'PENDING_REVIEW',
        rejectionReason: null,
        kybDocuments: [],
      }),
    );

    const documentForm = new FormData();
    documentForm.set('documentName', 'Business registration');
    documentForm.set(
      'document',
      new Blob([Buffer.from('%PDF-1.4\\n%%EOF')], { type: 'application/pdf' }),
      'registration.pdf',
    );
    const ownerDocumentUpload = await fetch(`${baseUrl}/tenant/onboarding/kyb-documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${pendingOwnerToken}` },
      body: documentForm,
    });
    expect(ownerDocumentUpload.status).toBe(201);
    const uploadedOwnerDocument = (await ownerDocumentUpload.json()) as {
      id: string;
      reviewStatus: string;
    };
    expect(uploadedOwnerDocument.reviewStatus).toBe('PENDING');

    const ownerUploadAudit = await prisma.auditLog.findFirst({
      where: {
        tenantId: flowTenantId,
        action: 'tenant.kyb_document_uploaded',
        resourceId: uploadedOwnerDocument.id,
      },
    });
    expect(ownerUploadAudit).not.toBeNull();

    const platformAdminEmail = `${flowTenantSlug}-reviewer@example.com`;
    const platformAdminPassword = 'HttpReviewerPassword123!';
    const unauthenticatedStats = await fetch(`${baseUrl}/platform/stats`);
    expect(unauthenticatedStats.status).toBe(401);
    const unauthenticatedTenants = await fetch(`${baseUrl}/platform/tenants`);
    expect(unauthenticatedTenants.status).toBe(401);

    const platformAdmin = await prisma.platformAdmin.create({
      data: {
        email: platformAdminEmail,
        name: 'HTTP Integration Reviewer',
        passwordHash: await authService.hashPassword(platformAdminPassword),
      },
      select: { id: true },
    });
    platformAdminId = platformAdmin.id;

    await prisma.tenantKybDocument.create({
      data: {
        tenantId: flowTenantId,
        documentName: 'Business registration',
        originalFilename: 'registration.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1,
        encryptionIv: 'test-iv',
        encryptionAuthTag: 'test-auth-tag',
        retentionExpiresAt: new Date(Date.now() + 60_000),
        reviewStatus: 'ACCEPTED',
        reviewedByPlatformAdminId: platformAdminId,
      },
    });

    const platformLogin = await fetch(`${baseUrl}/platform/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: platformAdminEmail,
        password: platformAdminPassword,
      }),
    });
    expect(platformLogin.status).toBe(200);
    const platformSetupChallenge = (await platformLogin.json()) as {
      mfaSetupRequired?: boolean;
      setupToken?: string;
      accessToken?: string;
    };
    expect(platformSetupChallenge.mfaSetupRequired).toBe(true);
    expect(platformSetupChallenge).not.toHaveProperty('accessToken');
    const platformSetupToken = platformSetupChallenge.setupToken;
    if (!platformSetupToken) {
      throw new Error('First platform login did not require MFA enrollment.');
    }

    const platformMfaSetup = await fetch(`${baseUrl}/platform/auth/mfa/setup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ setupToken: platformSetupToken }),
    });
    expect(platformMfaSetup.status).toBe(200);
    const platformMfaSetupBody = (await platformMfaSetup.json()) as { secret: string };
    const platformMfaConfirmation = await fetch(`${baseUrl}/platform/auth/mfa/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        setupToken: platformSetupToken,
        code: createTotpCode(platformMfaSetupBody.secret),
      }),
    });
    expect(platformMfaConfirmation.status).toBe(200);
    const platformLoginBody = (await platformMfaConfirmation.json()) as {
      accessToken?: string;
      recoveryCodes?: string[];
    };
    expect(platformLoginBody.recoveryCodes).toHaveLength(10);
    let platformAccessToken = platformLoginBody.accessToken;
    const platformRefreshCookie = getCookie(platformMfaConfirmation, 'spos_platform_refresh');
    expect(platformMfaConfirmation.headers.get('set-cookie')).toMatch(/HttpOnly/i);
    expect(platformMfaConfirmation.headers.get('set-cookie')).toMatch(/Path=\/api\/v1\/platform\/auth/i);
    if (!platformAccessToken) {
      throw new Error('Platform MFA confirmation did not create an authenticated session.');
    }

    const tenantTokenAtPlatformBoundary = await fetch(`${baseUrl}/platform/stats`, {
      headers: { Authorization: `Bearer ${pendingOwnerToken}` },
    });
    expect(tenantTokenAtPlatformBoundary.status).toBe(401);
    const platformTokenAtTenantBoundary = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${platformAccessToken}` },
    });
    expect(platformTokenAtTenantBoundary.status).toBe(401);

    const rejectedPlatformRefreshOrigin = await fetch(`${baseUrl}/platform/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: platformRefreshCookie,
        Origin: 'https://attacker.example',
      },
    });
    expect(rejectedPlatformRefreshOrigin.status).toBe(403);

    const platformRefresh = await fetch(`${baseUrl}/platform/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: platformRefreshCookie,
        Origin: 'http://localhost:5173',
      },
    });
    expect(platformRefresh.status).toBe(200);
    const refreshedPlatformSession = (await platformRefresh.json()) as { accessToken?: string };
    if (!refreshedPlatformSession.accessToken) {
      throw new Error('Platform refresh did not rotate the session.');
    }
    platformAccessToken = refreshedPlatformSession.accessToken;
    const rotatedPlatformRefreshCookie = getCookie(platformRefresh, 'spos_platform_refresh');
    expect(rotatedPlatformRefreshCookie).not.toBe(platformRefreshCookie);
    const authenticatedStats = await fetch(`${baseUrl}/platform/stats`, {
      headers: { Authorization: `Bearer ${platformAccessToken}` },
    });
    expect(authenticatedStats.status).toBe(200);
    const fiscalOverviewResponse = await fetch(`${baseUrl}/platform/fiscalization`, {
      headers: { Authorization: `Bearer ${platformAccessToken}` },
    });
    expect(fiscalOverviewResponse.status).toBe(200);
    const fiscalOverview = (await fiscalOverviewResponse.json()) as {
      providers: Array<Record<string, unknown>>;
      addonOffer: { isAvailable: boolean; monthlyPrice: string | null; annualPrice: string | null };
      fiscalTransactionsEnabled: boolean;
      taxCalculationEnabled: boolean;
      fiscalReceiptIssuanceEnabled: boolean;
    };
    expect(fiscalOverview).toMatchObject({
      addonOffer: { isAvailable: false, monthlyPrice: '35000', annualPrice: '400000' },
      fiscalTransactionsEnabled: false,
      taxCalculationEnabled: false,
      fiscalReceiptIssuanceEnabled: false,
    });
    expect(JSON.stringify(fiscalOverview)).not.toContain('credentialsEncrypted');
    const unapprovedFiscalProvider = await fetch(
      `${baseUrl}/platform/fiscalization/providers/MAINLAND_TANZANIA`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          providerName: 'Unapproved test provider',
          productionEndpoint: 'https://provider.example.test',
          sandboxEndpoint: null,
          documentationUrl: null,
          approvalStatus: 'UNVERIFIED',
          approvalEvidenceReference: null,
          isAvailable: true,
        }),
      },
    );
    expect(unapprovedFiscalProvider.status).toBe(400);

    const testPlanCode = `HTTP-${process.pid}-${Date.now()}`.toUpperCase();
    const planCreatedResponse = await fetch(`${baseUrl}/platform/plans`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        code: testPlanCode,
        name: 'HTTP Integration Plan',
        trialDays: 14,
        billingPeriodDays: 30,
        currency: 'USD',
        price: null,
        entitlements: {
          pos: true,
          products: true,
          inventory: true,
          purchasing: true,
          pharmacy: true,
          analytics: true,
          ai: true,
          stores: true,
          staff: true,
          campaigns: true,
        },
      }),
    });
    expect(planCreatedResponse.status).toBe(201);
    const createdPlan = (await planCreatedResponse.json()) as {
      id: string;
      versions: Array<{ id: string; version: number; isActive: boolean }>;
    };
    platformTestPlanId = createdPlan.id;
    expect(createdPlan.versions).toEqual([
      expect.objectContaining({ version: 1, isActive: true }),
    ]);

    const planVersionResponse = await fetch(
      `${baseUrl}/platform/plans/${createdPlan.id}/versions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trialDays: 14,
          billingPeriodDays: 30,
          currency: 'USD',
          price: null,
          entitlements: {
            pos: true,
            products: true,
            inventory: true,
            purchasing: true,
            pharmacy: true,
            analytics: true,
            ai: true,
            stores: true,
            staff: true,
            campaigns: true,
          },
        }),
      },
    );
    expect(planVersionResponse.status).toBe(201);
    const secondPlanVersion = (await planVersionResponse.json()) as {
      id: string;
      version: number;
      isActive: boolean;
    };
    expect(secondPlanVersion).toEqual(expect.objectContaining({ version: 2, isActive: true }));

    const assignedPlan = await fetch(`${baseUrl}/platform/tenants/${flowTenantId}/plan`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planVersionId: secondPlanVersion.id }),
    });
    expect(assignedPlan.status).toBe(200);
    expect(await assignedPlan.json()).toEqual(
      expect.objectContaining({
        status: 'TRIALING',
        plan: expect.objectContaining({ code: testPlanCode, version: 2 }),
      }),
    );

    const paidPlanVersionResponse = await fetch(
      `${baseUrl}/platform/plans/${createdPlan.id}/versions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trialDays: 0,
          billingPeriodDays: 30,
          currency: 'USD',
          price: '49.99',
          entitlements: { pos: true, products: true, staff: true },
        }),
      },
    );
    expect(paidPlanVersionResponse.status).toBe(201);
    const paidPlanVersion = (await paidPlanVersionResponse.json()) as {
      id: string;
      version: number;
      isActive: boolean;
    };
    expect(paidPlanVersion).toEqual(expect.objectContaining({ version: 3, isActive: true }));
    const paidPlanAssignment = await fetch(`${baseUrl}/platform/tenants/${flowTenantId}/plan`, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ planVersionId: paidPlanVersion.id }),
    });
    expect(paidPlanAssignment.status).toBe(200);
    expect(await paidPlanAssignment.json()).toEqual(expect.objectContaining({ status: 'PENDING_PAYMENT' }));
    const pendingPlanInvoice = await prisma.subscriptionInvoice.findFirst({
      where: { tenantId: flowTenantId },
      select: { amount: true, status: true, currency: true },
    });
    expect(pendingPlanInvoice?.amount.toString()).toBe('49.99');
    expect(pendingPlanInvoice).toEqual(expect.objectContaining({
      status: 'PENDING_PAYMENT',
      currency: 'USD',
    }));

    const finalTrialPlanVersionResponse = await fetch(
      `${baseUrl}/platform/plans/${createdPlan.id}/versions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          trialDays: 14,
          billingPeriodDays: 30,
          currency: 'USD',
          price: null,
          entitlements: {
            pos: true,
            products: true,
            inventory: true,
            purchasing: true,
            pharmacy: true,
            analytics: true,
            ai: true,
            stores: true,
            staff: true,
            campaigns: true,
          },
        }),
      },
    );
    expect(finalTrialPlanVersionResponse.status).toBe(201);
    const finalTrialPlanVersion = (await finalTrialPlanVersionResponse.json()) as {
      id: string;
      version: number;
      isActive: boolean;
    };
    expect(finalTrialPlanVersion).toEqual(expect.objectContaining({ version: 4, isActive: true }));
    const restoredTrialAssignment = await fetch(
      `${baseUrl}/platform/tenants/${flowTenantId}/plan`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planVersionId: finalTrialPlanVersion.id }),
      },
    );
    expect(restoredTrialAssignment.status).toBe(200);

    const disabledPlan = await fetch(`${baseUrl}/platform/plans/${createdPlan.id}/availability`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isAvailable: false }),
    });
    expect(disabledPlan.status).toBe(200);
    const unavailablePlanAssignment = await fetch(
      `${baseUrl}/platform/tenants/${flowTenantId}/plan`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ planVersionId: finalTrialPlanVersion.id }),
      },
    );
    expect(unavailablePlanAssignment.status).toBe(404);
    const enabledPlan = await fetch(`${baseUrl}/platform/plans/${createdPlan.id}/availability`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ isAvailable: true }),
    });
    expect(enabledPlan.status).toBe(200);

    platformInvitedAdminEmail = `http-invited-${process.pid}-${Date.now()}@example.com`;
    const invitationResponse = await fetch(`${baseUrl}/platform/admins/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: 'Invited Platform Admin', email: platformInvitedAdminEmail }),
    });
    expect(invitationResponse.status).toBe(201);
    expect(emailDelivery.sendPlatformAdminInvitation).toHaveBeenLastCalledWith(
      platformInvitedAdminEmail,
      'Invited Platform Admin',
      expect.any(String),
    );
    const invitationToken =
      emailDelivery.sendPlatformAdminInvitation.mock.calls.at(-1)?.[2] as string;
    const acceptedInvitation = await fetch(`${baseUrl}/platform/auth/invitation/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: invitationToken, password: 'InvitedPlatformPassword123!' }),
    });
    expect(acceptedInvitation.status).toBe(200);
    expect(await acceptedInvitation.json()).toEqual({
      accepted: true,
      email: platformInvitedAdminEmail,
    });
    const replayedInvitation = await fetch(`${baseUrl}/platform/auth/invitation/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: invitationToken, password: 'InvitedPlatformPassword123!' }),
    });
    expect(replayedInvitation.status).toBe(409);

    const platformAdminsResponse = await fetch(`${baseUrl}/platform/admins`, {
      headers: { Authorization: `Bearer ${platformAccessToken}` },
    });
    expect(platformAdminsResponse.status).toBe(200);
    const platformAdmins = (await platformAdminsResponse.json()) as Array<{
      id: string;
      email: string;
      status: string;
      mfaEnabled: boolean;
    }>;
    const invitedAdmin = platformAdmins.find(({ email }) => email === platformInvitedAdminEmail);
    if (!invitedAdmin) {
      throw new Error('The accepted platform administrator was not listed.');
    }
    expect(invitedAdmin).toEqual(expect.objectContaining({ status: 'ACTIVE', mfaEnabled: false }));
    const disableInvitedAdmin = await fetch(
      `${baseUrl}/platform/admins/${invitedAdmin.id}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'DISABLED' }),
      },
    );
    expect(disableInvitedAdmin.status).toBe(200);
    const reenableInvitedAdmin = await fetch(
      `${baseUrl}/platform/admins/${invitedAdmin.id}/status`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'ACTIVE' }),
      },
    );
    expect(reenableInvitedAdmin.status).toBe(200);

    const supportGrantResponse = await fetch(`${baseUrl}/platform/support-access`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        tenantId: flowTenantId,
        purpose: 'HTTP integration support case verification',
        scopes: ['tenant_profile'],
        durationMinutes: 5,
      }),
    });
    expect(supportGrantResponse.status).toBe(201);
    const supportGrant = (await supportGrantResponse.json()) as { id: string; expiresAt: string };
    expect(Date.parse(supportGrant.expiresAt)).toBeGreaterThan(Date.now());
    const scopedTenantProfile = await fetch(
      `${baseUrl}/platform/support-access/${supportGrant.id}/tenant`,
      { headers: { Authorization: `Bearer ${platformAccessToken}` } },
    );
    expect(scopedTenantProfile.status).toBe(200);
    const supportTenantData = (await scopedTenantProfile.json()) as Record<string, unknown>;
    expect(supportTenantData).toEqual(expect.objectContaining({ id: flowTenantId }));
    expect(supportTenantData).not.toHaveProperty('_count');
    expect(supportTenantData).not.toHaveProperty('memberships');
    const unsupportedScopeResponse = await fetch(
      `${baseUrl}/platform/support-access/${supportGrant.id}/stores`,
      { headers: { Authorization: `Bearer ${platformAccessToken}` } },
    );
    expect(unsupportedScopeResponse.status).toBe(403);
    const supportEvents = await prisma.platformSupportAccessEvent.findMany({
      where: { supportAccessId: supportGrant.id },
    });
    expect(supportEvents.map(({ action }) => action)).toEqual(
      expect.arrayContaining(['grant_created', 'scoped_data_read']),
    );
    await expect(
      prisma.platformSupportAccessEvent.update({
        where: { id: supportEvents[0].id },
        data: { action: 'tampered' },
      }),
    ).rejects.toThrow(/Audit records are immutable/);
    const revokeSupportGrant = await fetch(
      `${baseUrl}/platform/support-access/${supportGrant.id}`,
      {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${platformAccessToken}` },
      },
    );
    expect(revokeSupportGrant.status).toBe(200);
    const revokedSupportRead = await fetch(
      `${baseUrl}/platform/support-access/${supportGrant.id}/tenant`,
      { headers: { Authorization: `Bearer ${platformAccessToken}` } },
    );
    expect(revokedSupportRead.status).toBe(403);
    const supportAccessList = await fetch(`${baseUrl}/platform/support-access`, {
      headers: { Authorization: `Bearer ${platformAccessToken}` },
    });
    expect(supportAccessList.status).toBe(200);
    const supportAccessEntries = (await supportAccessList.json()) as Array<{
      id: string;
      events: Array<{ action: string; scope: string | null }>;
    }>;
    const listedSupportGrant = supportAccessEntries.find(({ id }) => id === supportGrant.id);
    expect(listedSupportGrant?.events.map(({ action }) => action)).toEqual(
      expect.arrayContaining(['grant_created', 'scoped_data_read', 'grant_revoked']),
    );

    const pendingTenantQueue = await fetch(
      `${baseUrl}/platform/tenants?search=${encodeURIComponent(flowTenantSlug)}&status=PENDING_REVIEW`,
      { headers: { Authorization: `Bearer ${platformAccessToken}` } },
    );
    expect(pendingTenantQueue.status).toBe(200);
    const pendingTenantQueueBody = (await pendingTenantQueue.json()) as {
      total: number;
      items: Array<{
        id: string;
        slug: string;
        memberships: Array<{ user: { email: string } }>;
        subscription: { status: string };
        kybDocuments: Array<{ reviewStatus: string }>;
      }>;
    };
    expect(pendingTenantQueueBody).toEqual(
      expect.objectContaining({
        total: 1,
        items: [
          expect.objectContaining({
            id: flowTenantId,
            slug: flowTenantSlug,
            memberships: [
              expect.objectContaining({
                user: expect.objectContaining({ email: flowOwnerEmail }),
              }),
            ],
            subscription: expect.objectContaining({ status: 'TRIALING' }),
            kybDocuments: expect.arrayContaining([
              expect.objectContaining({ reviewStatus: 'PENDING' }),
              expect.objectContaining({ reviewStatus: 'ACCEPTED' }),
            ]),
          }),
        ],
      }),
    );

    const approval = await fetch(
      `${baseUrl}/platform/tenants/${flowTenantId}/approve`,
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${platformAccessToken}` },
      },
    );
    expect(approval.status).toBe(201);
    expect(await approval.json()).toEqual({ approved: true });

    const approvedTenant = await prisma.tenant.findUnique({
      where: { id: flowTenantId },
      select: { status: true },
    });
    expect(approvedTenant?.status).toBe('ACTIVE');
    const closedApplicantPortalAfterApproval = await fetch(
      `${baseUrl}/tenant/onboarding/status`,
      { headers: { Authorization: `Bearer ${pendingOwnerToken}` } },
    );
    expect(closedApplicantPortalAfterApproval.status).toBe(403);
    const suspendedTenant = await fetch(`${baseUrl}/platform/tenants/${flowTenantId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'SUSPENDED' }),
    });
    expect(suspendedTenant.status).toBe(200);
    expect((await prisma.tenant.findUnique({
      where: { id: flowTenantId },
      select: { status: true },
    }))?.status).toBe('SUSPENDED');
    const reactivatedTenant = await fetch(`${baseUrl}/platform/tenants/${flowTenantId}/status`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${platformAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ status: 'ACTIVE' }),
    });
    expect(reactivatedTenant.status).toBe(200);
    expect(await prisma.platformAuditLog.count({
      where: {
        resource: 'tenant',
        resourceId: flowTenantId,
        action: { in: ['platform.tenant.suspended', 'platform.tenant.reactivated'] },
      },
    })).toBe(2);
    const closedApplicantPortal = await fetch(`${baseUrl}/tenant/onboarding/status`, {
      headers: { Authorization: `Bearer ${pendingOwnerToken}` },
    });
    expect(closedApplicantPortal.status).toBe(401);

    const ownerLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: flowOwnerEmail,
        tenantSlug: flowTenantSlug,
        password: 'HttpIntegrationPassword123!',
      }),
    });
    expect(ownerLogin.status).toBe(200);
    const ownerLoginBody = (await ownerLogin.json()) as { accessToken?: string };
    const accessToken = ownerLoginBody.accessToken;
    if (!accessToken) {
      throw new Error('Approved tenant owner login did not return an access token.');
    }

    const tenantRolesResponse = await fetch(`${baseUrl}/tenant/roles`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(tenantRolesResponse.status).toBe(200);
    const tenantRoles = (await tenantRolesResponse.json()) as Array<{
      id: string;
      name: string;
      permissions: Array<{ permission: { code: string } }>;
    }>;
    const ownerRole = tenantRoles.find(({ name }) => name === 'Tenant Owner');
    if (!ownerRole) {
      throw new Error('The registered tenant is missing its Tenant Owner role.');
    }
    expect(ownerRole.permissions.map(({ permission }) => permission.code)).toEqual(
      expect.arrayContaining([
        'roles.view',
        'roles.create',
        'roles.update',
        'roles.assign_permissions',
        'business_settings.view',
        'business_settings.update',
        'fiscal_settings.view',
        'fiscal_settings.update',
      ]),
    );

    const businessSettingsResponse = await fetch(`${baseUrl}/tenant/settings`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(businessSettingsResponse.status).toBe(200);
    expect(await businessSettingsResponse.json()).toEqual(expect.objectContaining({
      name: 'HTTP Integration Store',
      currency: 'TZS',
      timezone: 'Africa/Dar_es_Salaam',
      taxEnabled: false,
      taxStatus: 'DISABLED_PENDING_REVIEW',
    }));
    const tenantFiscalSettings = await fetch(`${baseUrl}/tenant/fiscalization`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(tenantFiscalSettings.status).toBe(200);
    const tenantFiscalSettingsBody = (await tenantFiscalSettings.json()) as {
      profiles: Array<Record<string, unknown>>;
      fiscalTransactionsEnabled: boolean;
      taxCalculationEnabled: boolean;
      fiscalReceiptIssuanceEnabled: boolean;
    };
    expect(tenantFiscalSettingsBody).toMatchObject({
      profiles: [],
      fiscalTransactionsEnabled: false,
      taxCalculationEnabled: false,
      fiscalReceiptIssuanceEnabled: false,
    });
    const previousNodeEnvironment = process.env.NODE_ENV;
    const previousSimulatorFlag = process.env.FISCAL_SIMULATOR_ENABLED;
    process.env.NODE_ENV = 'test';
    process.env.FISCAL_SIMULATOR_ENABLED = 'true';
    try {
      const simulationResponse = await fetch(
        `${baseUrl}/tenant/fiscalization/simulator/run`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jurisdiction: 'MAINLAND_TANZANIA',
            scenario: 'ACCEPTED',
          }),
        },
      );
      expect(simulationResponse.status).toBe(200);
      expect(await simulationResponse.json()).toMatchObject({
        simulationOnly: true,
        officialReceiptIssued: false,
        salesRecordCreated: false,
        taxCalculated: false,
        providerContacted: false,
        outcome: 'SIMULATED_ACCEPTED',
      });
    } finally {
      if (previousNodeEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = previousNodeEnvironment;
      if (previousSimulatorFlag === undefined) delete process.env.FISCAL_SIMULATOR_ENABLED;
      else process.env.FISCAL_SIMULATOR_ENABLED = previousSimulatorFlag;
    }
    const previousBillingFlag = process.env.FISCAL_ADDON_TEST_BILLING_ENABLED;
    const billingNodeEnvironment = process.env.NODE_ENV;
    const originalFiscalAddonOffer = await prisma.fiscalAddonOffer.findUnique({
      where: { id: 'fiscalization' },
    });
    if (!originalFiscalAddonOffer) {
      throw new Error('The fiscal add-on test offer is missing from the test database.');
    }
    process.env.NODE_ENV = 'test';
    process.env.FISCAL_ADDON_TEST_BILLING_ENABLED = 'true';
    try {
      await prisma.fiscalAddonOffer.update({
        where: { id: 'fiscalization' },
        data: {
          isAvailable: true,
          isTestOnly: true,
          currency: 'TZS',
          monthlyPrice: '35000',
          annualPrice: '400000',
        },
      });
      const checkoutResponse = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-subscriptions/checkout`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            jurisdiction: 'MAINLAND_TANZANIA',
            billingPeriod: 'MONTHLY',
          }),
        },
      );
      expect(checkoutResponse.status).toBe(200);
      const checkoutInvoice = (await checkoutResponse.json()) as {
        id: string;
        fiscalAddonSubscriptionId: string;
        amount: string;
        currency: string;
        isTestMode: boolean;
        status: string;
      };
      expect(checkoutInvoice).toMatchObject({
        amount: '35000',
        currency: 'TZS',
        isTestMode: true,
        status: 'PENDING_PAYMENT',
      });
      const testPaymentResponse = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-invoices/${checkoutInvoice.id}/simulate-payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            outcome: 'PAID',
            idempotencyKey: '8ae8a74b-e051-4d08-9eb3-f3b289d33f14',
          }),
        },
      );
      expect(testPaymentResponse.status).toBe(200);
      expect(await testPaymentResponse.json()).toMatchObject({
        simulationOnly: true,
        realChargeMade: false,
        subscriptionStatus: 'ACTIVE',
        payment: { status: 'PAID', isTestMode: true, amount: '35000' },
        invoice: { status: 'PAID', isTestMode: true },
      });
      const repeatedPaymentResponse = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-invoices/${checkoutInvoice.id}/simulate-payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            outcome: 'PAID',
            idempotencyKey: '8ae8a74b-e051-4d08-9eb3-f3b289d33f14',
          }),
        },
      );
      expect(repeatedPaymentResponse.status).toBe(200);
      expect(await repeatedPaymentResponse.json()).toMatchObject({
        idempotent: true,
        simulationOnly: true,
        realChargeMade: false,
        payment: { status: 'PAID', isTestMode: true },
      });
      await expect(prisma.subscriptionPayment.count({
        where: { invoiceId: checkoutInvoice.id },
      })).resolves.toBe(1);

      const renewedInvoiceResponse = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-subscriptions/${checkoutInvoice.fiscalAddonSubscriptionId}/renew`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      expect(renewedInvoiceResponse.status).toBe(200);
      const renewedInvoice = (await renewedInvoiceResponse.json()) as { id: string };
      const failedRenewal = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-invoices/${renewedInvoice.id}/simulate-payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            outcome: 'FAILED',
            idempotencyKey: 'aa98e94b-4dd5-41a1-9c2a-807a098e13a2',
          }),
        },
      );
      expect(failedRenewal.status).toBe(200);
      expect(await failedRenewal.json()).toMatchObject({
        subscriptionStatus: 'PAST_DUE',
        realChargeMade: false,
        invoice: { status: 'FAILED' },
      });

      const retryInvoiceResponse = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-subscriptions/${checkoutInvoice.fiscalAddonSubscriptionId}/renew`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      expect(retryInvoiceResponse.status).toBe(200);
      const retryInvoice = (await retryInvoiceResponse.json()) as { id: string };
      const successfulRetry = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-invoices/${retryInvoice.id}/simulate-payment`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            outcome: 'PAID',
            idempotencyKey: 'fcad9e03-8a09-4819-bfd7-2a159bfe390e',
          }),
        },
      );
      expect(successfulRetry.status).toBe(200);
      expect(await successfulRetry.json()).toMatchObject({ subscriptionStatus: 'ACTIVE' });

      const cancelResponse = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-subscriptions/${checkoutInvoice.fiscalAddonSubscriptionId}/cancel`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      expect(cancelResponse.status).toBe(200);
      expect(await cancelResponse.json()).toMatchObject({
        canceled: true,
        cancellationAtPeriodEnd: true,
        cancelAtPeriodEnd: true,
      });
      const resumeResponse = await fetch(
        `${baseUrl}/tenant/fiscalization/addon-subscriptions/${checkoutInvoice.fiscalAddonSubscriptionId}/resume`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      );
      expect(resumeResponse.status).toBe(200);
      expect(await resumeResponse.json()).toMatchObject({
        canceled: false,
        cancelAtPeriodEnd: false,
      });

      const testInvoices = await prisma.subscriptionInvoice.findMany({
        where: { fiscalAddonSubscriptionId: checkoutInvoice.fiscalAddonSubscriptionId },
        include: { payments: true },
        orderBy: { createdAt: 'asc' },
      });
      expect(testInvoices).toHaveLength(3);
      expect(testInvoices.every((invoice) => invoice.isTestMode)).toBe(true);
      expect(testInvoices.flatMap((invoice) => invoice.payments).every((payment) => payment.isTestMode)).toBe(true);
      expect(testInvoices.map((invoice) => invoice.status)).toEqual(['PAID', 'FAILED', 'PAID']);
      expect(testInvoices.flatMap((invoice) => invoice.payments).every(
        (payment) => payment.providerId === null,
      )).toBe(true);
      const billingAuditEntries = await prisma.auditLog.findMany({
        where: {
          tenantId: flowTenantId,
          action: { startsWith: 'fiscal_addon.' },
        },
      });
      expect(billingAuditEntries.length).toBeGreaterThanOrEqual(6);
      const fiscalStateAfterBilling = await fetch(`${baseUrl}/tenant/fiscalization`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      expect(await fiscalStateAfterBilling.json()).toMatchObject({
        fiscalTransactionsEnabled: false,
        taxCalculationEnabled: false,
        fiscalReceiptIssuanceEnabled: false,
      });
    } finally {
      if (billingNodeEnvironment === undefined) delete process.env.NODE_ENV;
      else process.env.NODE_ENV = billingNodeEnvironment;
      if (previousBillingFlag === undefined) delete process.env.FISCAL_ADDON_TEST_BILLING_ENABLED;
      else process.env.FISCAL_ADDON_TEST_BILLING_ENABLED = previousBillingFlag;
      await prisma.fiscalAddonOffer.update({
        where: { id: originalFiscalAddonOffer.id },
        data: {
          isAvailable: originalFiscalAddonOffer.isAvailable,
          isTestOnly: originalFiscalAddonOffer.isTestOnly,
          currency: originalFiscalAddonOffer.currency,
          monthlyPrice: originalFiscalAddonOffer.monthlyPrice,
          annualPrice: originalFiscalAddonOffer.annualPrice,
        },
      });
    }
    const savedFiscalProfileResponse = await fetch(
      `${baseUrl}/tenant/fiscalization/profiles/MAINLAND_TANZANIA`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          legalName: 'HTTP Integration Retail Limited',
          taxIdentificationNumber: 'TIN-HTTP-100',
          vatRegistrationNumber: 'VRN-HTTP-100',
          providerConfigurationId: null,
          credentials: { token: 'tenant-provider-secret' },
        }),
      },
    );
    expect(savedFiscalProfileResponse.status).toBe(200);
    const savedFiscalProfile = (await savedFiscalProfileResponse.json()) as {
      jurisdiction: string;
      legalName: string;
      credentialsConfigured: boolean;
      credentialsEncrypted?: string;
    };
    expect(savedFiscalProfile).toMatchObject({
      jurisdiction: 'MAINLAND_TANZANIA',
      legalName: 'HTTP Integration Retail Limited',
      credentialsConfigured: true,
    });
    expect(savedFiscalProfile).not.toHaveProperty('credentialsEncrypted');
    const storedFiscalProfile = await prisma.tenantFiscalProfile.findUnique({
      where: {
        tenantId_jurisdiction: {
          tenantId: flowTenantId,
          jurisdiction: 'MAINLAND_TANZANIA',
        },
      },
    });
    expect(storedFiscalProfile?.credentialsEncrypted).not.toContain('tenant-provider-secret');
    const fiscalProfileAudit = await prisma.auditLog.findFirst({
      where: {
        tenantId: flowTenantId,
        action: 'fiscal_profile.updated',
        resourceId: storedFiscalProfile?.id,
      },
    });
    expect(JSON.stringify(fiscalProfileAudit?.metadata)).not.toContain('tenant-provider-secret');
    const platformTokenAtTenantFiscalBoundary = await fetch(`${baseUrl}/tenant/fiscalization`, {
      headers: { Authorization: `Bearer ${platformAccessToken}` },
    });
    expect(platformTokenAtTenantFiscalBoundary.status).toBe(401);
    const unavailableAddonRequest = await fetch(`${baseUrl}/tenant/fiscalization/addon-requests`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jurisdiction: 'MAINLAND_TANZANIA' }),
    });
    expect(unavailableAddonRequest.status).toBe(400);
    await expect(prisma.tenant.update({
      where: { id: flowTenantId },
      data: { currency: 'USD' },
    })).rejects.toThrow();
    await expect(prisma.tenant.update({
      where: { id: flowTenantId },
      data: { timezone: 'UTC' },
    })).rejects.toThrow();
    await expect(prisma.tenant.update({
      where: { id: flowTenantId },
      data: { taxEnabled: true },
    })).rejects.toThrow();

    const invalidBusinessSettings = await fetch(`${baseUrl}/tenant/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'HTTP Integration Store',
        businessAddress: '',
        contactEmail: '',
        contactPhone: '',
        currency: 'USD',
      }),
    });
    expect(invalidBusinessSettings.status).toBe(400);

    const updateBusinessSettings = await fetch(`${baseUrl}/tenant/settings`, {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'HTTP Integration Store',
        businessAddress: '123 Test Street, Dar es Salaam',
        contactEmail: 'contact@example.com',
        contactPhone: '+255 712 345 678',
      }),
    });
    expect(updateBusinessSettings.status).toBe(200);
    expect(await updateBusinessSettings.json()).toEqual(expect.objectContaining({
      businessAddress: '123 Test Street, Dar es Salaam',
      contactEmail: 'contact@example.com',
      contactPhone: '+255 712 345 678',
      currency: 'TZS',
      timezone: 'Africa/Dar_es_Salaam',
      taxEnabled: false,
    }));
    expect(await prisma.auditLog.findFirst({
      where: {
        tenantId: flowTenantId,
        action: 'business_settings.updated',
        resource: 'tenant_business_settings',
      },
    })).not.toBeNull();

    const assignablePermissionsResponse = await fetch(`${baseUrl}/tenant/permissions`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(assignablePermissionsResponse.status).toBe(200);
    const assignablePermissions = (await assignablePermissionsResponse.json()) as Array<{ code: string }>;
    expect(assignablePermissions.map(({ code }) => code)).toContain('products.create');
    expect(assignablePermissions.map(({ code }) => code)).not.toContain('sales.refund');

    const createdRoleResponse = await fetch(`${baseUrl}/tenant/roles`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name: 'HTTP Integration Clerk',
        description: 'Limited product access',
        permissionCodes: ['products.view', 'products.create'],
      }),
    });
    expect(createdRoleResponse.status).toBe(201);
    const createdRole = (await createdRoleResponse.json()) as {
      id: string;
      permissions: Array<{ permission: { code: string } }>;
    };
    expect(createdRole.permissions.map(({ permission }) => permission.code)).toEqual(
      expect.arrayContaining(['products.view', 'products.create']),
    );

    const privilegeEscalationAttempt = await fetch(
      `${baseUrl}/tenant/roles/${createdRole.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissionCodes: ['sales.refund'] }),
      },
    );
    expect(privilegeEscalationAttempt.status).toBe(403);

    const protectedOwnerRoleUpdate = await fetch(
      `${baseUrl}/tenant/roles/${ownerRole.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Compromised Owner' }),
      },
    );
    expect(protectedOwnerRoleUpdate.status).toBe(409);

    const updatedRoleResponse = await fetch(
      `${baseUrl}/tenant/roles/${createdRole.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ permissionCodes: ['products.view'] }),
      },
    );
    expect(updatedRoleResponse.status).toBe(200);
    const updatedRole = (await updatedRoleResponse.json()) as {
      permissions: Array<{ permission: { code: string } }>;
    };
    expect(updatedRole.permissions.map(({ permission }) => permission.code)).toEqual(['products.view']);
    const roleAuditLog = await prisma.auditLog.findFirst({
      where: {
        tenantId: flowTenantId,
        action: 'roles.updated',
        resourceId: createdRole.id,
      },
    });
    expect(roleAuditLog).not.toBeNull();

    const sku = `HTTP-${process.pid}-${Date.now()}`;
    const createProduct = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        sku,
        name: 'HTTP Integration Product',
        baseUnit: 'each',
        sellingPrice: '4.25',
        costPrice: '2.10',
      }),
    });

    expect(createProduct.status).toBe(201);
    const product = (await createProduct.json()) as {
      id: string;
      tenantId: string;
      sku: string;
      sellingPrice: string;
    };
    expect(product).toEqual(
      expect.objectContaining({
        tenantId: flowTenantId,
        sku,
        sellingPrice: '4.25',
      }),
    );

    const listProducts = await fetch(
      `${baseUrl}/products?search=${encodeURIComponent(sku)}`,
      { headers: { Authorization: `Bearer ${accessToken}` } },
    );
    expect(listProducts.status).toBe(200);
    const productList = (await listProducts.json()) as {
      items: Array<{ id: string; sku: string }>;
      total: number;
    };
    expect(productList).toEqual(
      expect.objectContaining({
        total: 1,
        items: [expect.objectContaining({ id: product.id, sku })],
      }),
    );
    const productAuditLog = await prisma.auditLog.findFirst({
      where: {
        tenantId: flowTenantId,
        action: 'products.created',
        resourceId: product.id,
      },
    });
    expect(productAuditLog).not.toBeNull();

    deactivatedStaffEmail = `${flowTenantSlug}-staff@example.com`;
    const staffUser = await prisma.user.create({
      data: {
        email: deactivatedStaffEmail,
        passwordHash: await authService.hashPassword('HttpStaffPassword123!'),
        name: 'HTTP Integration Staff',
        emailVerifiedAt: new Date(),
      },
    });
    const staffMembership = await prisma.membership.create({
      data: {
        tenantId: flowTenantId,
        userId: staffUser.id,
        status: 'ACTIVE',
        allStoreAccess: false,
      },
    });
    const secondaryTenant = await prisma.tenant.create({
      data: {
        slug: `${flowTenantSlug}-secondary`,
        name: 'HTTP Integration Secondary Store',
        status: 'ACTIVE',
      },
      select: { id: true },
    });
    secondaryTenantId = secondaryTenant.id;
    const foreignRole = await prisma.role.create({
      data: { tenantId: secondaryTenant.id, name: 'Foreign Tenant Role' },
      select: { id: true },
    });
    const crossTenantRoleUpdate = await fetch(
      `${baseUrl}/tenant/roles/${foreignRole.id}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: 'Cross-Tenant Mutation' }),
      },
    );
    expect(crossTenantRoleUpdate.status).toBe(404);
    const secondaryMembership = await prisma.membership.create({
      data: {
        tenantId: secondaryTenant.id,
        userId: staffUser.id,
        status: 'ACTIVE',
        allStoreAccess: false,
      },
      select: { id: true },
    });
    secondaryMembershipId = secondaryMembership.id;
    const secondaryStaffSession = await authService.createUserSession(
      staffUser.id,
      secondaryMembership.id,
    );
    secondaryStaffSessionId = secondaryStaffSession.id;
    const secondaryStaffAccessToken = authService.signToken(
      staffUser.id,
      secondaryMembership.id,
      secondaryStaffSession.id,
    );
    const storeManagerRole = await prisma.role.findFirst({
      where: { tenantId: flowTenantId, name: 'Store Manager' },
      select: { id: true },
    });
    if (!storeManagerRole) {
      throw new Error('The registered tenant is missing its Store Manager role.');
    }
    const staffInvitePermission = await prisma.permission.findUnique({
      where: { code: 'staff.invite' },
      select: { id: true },
    });
    if (!staffInvitePermission) {
      throw new Error('The integration database is missing the staff.invite permission.');
    }
    await prisma.membershipRole.create({
      data: {
        tenantId: flowTenantId,
        membershipId: staffMembership.id,
        roleId: storeManagerRole.id,
      },
    });
    await prisma.rolePermission.createMany({
      data: [{ roleId: storeManagerRole.id, permissionId: staffInvitePermission.id }],
      skipDuplicates: true,
    });
    const staffSession = await authService.createUserSession(staffUser.id, staffMembership.id);
    const staffAccessToken = authService.signToken(
      staffUser.id,
      staffMembership.id,
      staffSession.id,
    );
    const activeStaffSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${staffAccessToken}` },
    });
    expect(activeStaffSession.status).toBe(200);
    const escalatedStaffInvitation = await fetch(`${baseUrl}/tenant/staff/invitations`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${staffAccessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: `${flowTenantSlug}-escalation@example.com`,
        roleId: createdRole.id,
      }),
    });
    expect(escalatedStaffInvitation.status).toBe(403);
    const activeSecondaryStaffSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${secondaryStaffAccessToken}` },
    });
    expect(activeSecondaryStaffSession.status).toBe(200);
    const lastOwnerMembership = await prisma.membership.findFirst({
      where: { tenantId: flowTenantId, user: { email: flowOwnerEmail } },
      select: { id: true },
    });
    const deactivatePermission = await prisma.permission.findUnique({
      where: { code: 'staff.deactivate' },
      select: { id: true },
    });
    if (!lastOwnerMembership || !deactivatePermission) {
      throw new Error('The integration fixture is missing its owner membership or deactivation permission.');
    }
    await prisma.rolePermission.createMany({
      data: [{ roleId: storeManagerRole.id, permissionId: deactivatePermission.id }],
      skipDuplicates: true,
    });
    const rejectedLastOwnerDeactivation = await fetch(
      `${baseUrl}/tenant/staff/${lastOwnerMembership.id}/deactivate`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${staffAccessToken}` },
      },
    );
    expect(rejectedLastOwnerDeactivation.status).toBe(409);

    const deactivation = await fetch(
      `${baseUrl}/tenant/staff/${staffMembership.id}/deactivate`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    expect(deactivation.status).toBe(200);
    expect(await deactivation.json()).toEqual({
      membershipId: staffMembership.id,
      status: 'SUSPENDED',
    });
    const suspendedMembership = await prisma.membership.findUnique({
      where: { id: staffMembership.id },
      select: { status: true },
    });
    expect(suspendedMembership?.status).toBe('SUSPENDED');
    const revokedStaffSession = await prisma.authSession.findFirst({
      where: { id: staffSession.id },
      select: { revokedAt: true },
    });
    expect(revokedStaffSession?.revokedAt).not.toBeNull();
    const unaffectedSecondarySession = await prisma.authSession.findFirst({
      where: { id: secondaryStaffSession.id },
      select: { revokedAt: true },
    });
    expect(unaffectedSecondarySession?.revokedAt).toBeNull();
    const unaffectedSecondaryMembership = await prisma.membership.findUnique({
      where: { id: secondaryMembership.id },
      select: { status: true },
    });
    expect(unaffectedSecondaryMembership?.status).toBe('ACTIVE');
    const stillActiveInOtherTenant = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${secondaryStaffAccessToken}` },
    });
    expect(stillActiveInOtherTenant.status).toBe(200);
    const rejectedStaffAccess = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${staffAccessToken}` },
    });
    expect(rejectedStaffAccess.status).toBe(401);

    const ownerMembership = await prisma.membership.findFirst({
      where: { tenantId: flowTenantId, user: { email: flowOwnerEmail } },
      select: { id: true },
    });
    if (!ownerMembership) {
      throw new Error('The registered tenant owner membership could not be found.');
    }
    const selfDeactivation = await fetch(
      `${baseUrl}/tenant/staff/${ownerMembership.id}/deactivate`,
      {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${accessToken}` },
      },
    );
    expect(selfDeactivation.status).toBe(409);

    const deactivationAuditLog = await prisma.auditLog.findFirst({
      where: {
        tenantId: flowTenantId,
        action: 'staff.membership_deactivated',
        resourceId: staffMembership.id,
      },
    });
    expect(deactivationAuditLog).not.toBeNull();

    const resetRequest = await fetch(`${baseUrl}/auth/password/forgot`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: flowOwnerEmail }),
    });
    expect(resetRequest.status).toBe(200);
    const resetResponseBody = await resetRequest.json();
    expect(resetResponseBody).toEqual({
      message: 'If an account exists for this address, password reset instructions will be sent.',
    });
    expect(resetResponseBody).not.toHaveProperty('token');
    const emailedResetToken = emailDelivery.sendPasswordReset.mock.calls.at(-1)?.[1] as string;
    expect(emailedResetToken).toEqual(expect.any(String));

    const resetPassword = await fetch(`${baseUrl}/auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: emailedResetToken,
        password: 'HttpResetPassword123!',
      }),
    });
    expect(resetPassword.status).toBe(200);
    const replayedReset = await fetch(`${baseUrl}/auth/password/reset`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: emailedResetToken,
        password: 'ReplayedResetPassword123!',
      }),
    });
    expect(replayedReset.status).toBe(401);
    const oldPasswordLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: flowOwnerEmail,
        tenantSlug: flowTenantSlug,
        password: 'HttpIntegrationPassword123!',
      }),
    });
    expect(oldPasswordLogin.status).toBe(401);
    const newPasswordLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: flowOwnerEmail,
        tenantSlug: flowTenantSlug,
        password: 'HttpResetPassword123!',
      }),
    });
    expect(newPasswordLogin.status).toBe(200);
    const revokedOwnerSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(revokedOwnerSession.status).toBe(401);
    const newPasswordLoginBody = (await newPasswordLogin.json()) as { accessToken?: string };
    if (!newPasswordLoginBody.accessToken) {
      throw new Error('The reset password did not create an authenticated session.');
    }
    const tenantLogout = await fetch(`${baseUrl}/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${newPasswordLoginBody.accessToken}` },
    });
    expect(tenantLogout.status).toBe(200);
    expect(await tenantLogout.json()).toEqual({ loggedOut: true });
    const loggedOutOwnerSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${newPasswordLoginBody.accessToken}` },
    });
    expect(loggedOutOwnerSession.status).toBe(401);

    rejectedTenantSlug = `http-rejected-${process.pid}-${Date.now()}`;
    rejectedOwnerEmail = `${rejectedTenantSlug}@example.com`;
    const rejectedRegistration = await fetch(`${baseUrl}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantName: 'Rejected HTTP Integration Store',
        tenantSlug: rejectedTenantSlug,
        businessType: 'RETAIL',
        ownerName: 'Rejected HTTP Integration Owner',
        ownerEmail: rejectedOwnerEmail,
        password: 'HttpRejectedPassword123!',
        planCode: 'STARTER',
      }),
    });
    expect(rejectedRegistration.status).toBe(201);
    const rejectedVerificationToken =
      emailDelivery.sendEmailVerification.mock.calls.at(-1)?.[1] as string;
    expect(rejectedVerificationToken).toEqual(expect.any(String));
    const rejectedEmailVerification = await fetch(`${baseUrl}/auth/email/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: rejectedVerificationToken }),
    });
    expect(rejectedEmailVerification.status).toBe(200);
    const rejectedTenant = await prisma.tenant.findUnique({
      where: { slug: rejectedTenantSlug },
      select: { id: true, status: true },
    });
    expect(rejectedTenant?.status).toBe('PENDING_REVIEW');
    if (!rejectedTenant) {
      throw new Error('Rejected test tenant was not persisted.');
    }

    const rejection = await fetch(
      `${baseUrl}/platform/tenants/${rejectedTenant.id}/reject`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${platformAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason: 'Required registration details were not verified.' }),
      },
    );
    expect(rejection.status).toBe(201);
    expect(await rejection.json()).toEqual({ rejected: true });

    const rejectedStatus = await prisma.tenant.findUnique({
      where: { id: rejectedTenant.id },
      select: { status: true },
    });
    expect(rejectedStatus?.status).toBe('REJECTED');

    const rejectedOwnerLogin = await fetch(`${baseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: rejectedOwnerEmail,
        tenantSlug: rejectedTenantSlug,
        password: 'HttpRejectedPassword123!',
      }),
    });
    expect(rejectedOwnerLogin.status).toBe(200);
    const rejectedOwnerLoginBody = (await rejectedOwnerLogin.json()) as {
      accessToken?: string;
      user?: { tenantStatus: string; permissions: string[] };
    };
    expect(rejectedOwnerLoginBody.user).toEqual(
      expect.objectContaining({ tenantStatus: 'REJECTED', permissions: [] }),
    );
    if (!rejectedOwnerLoginBody.accessToken) {
      throw new Error('Rejected tenant owner login did not return an application-only session.');
    }
    const rejectedApplicantStatus = await fetch(`${baseUrl}/tenant/onboarding/status`, {
      headers: { Authorization: `Bearer ${rejectedOwnerLoginBody.accessToken}` },
    });
    expect(rejectedApplicantStatus.status).toBe(200);
    expect(await rejectedApplicantStatus.json()).toEqual(
      expect.objectContaining({
        status: 'REJECTED',
        rejectionReason: 'Required registration details were not verified.',
      }),
    );
    const rejectedTenantProducts = await fetch(`${baseUrl}/products`, {
      headers: { Authorization: `Bearer ${rejectedOwnerLoginBody.accessToken}` },
    });
    expect(rejectedTenantProducts.status).toBe(403);

    const rejectedDocumentForm = new FormData();
    rejectedDocumentForm.set('documentName', 'Replacement document');
    const rejectedOwnerUpload = await fetch(`${baseUrl}/tenant/onboarding/kyb-documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${rejectedOwnerLoginBody.accessToken}` },
      body: rejectedDocumentForm,
    });
    expect(rejectedOwnerUpload.status).toBe(409);

    const rejectedTenantQueue = await fetch(
      `${baseUrl}/platform/tenants?status=REJECTED&search=${encodeURIComponent(rejectedTenantSlug)}`,
      { headers: { Authorization: `Bearer ${platformAccessToken}` } },
    );
    expect(rejectedTenantQueue.status).toBe(200);
    const rejectedTenantQueueBody = (await rejectedTenantQueue.json()) as {
      items: Array<{ status: string; reviewEvents: Array<{ metadata: { reason: string } }> }>;
    };
    expect(rejectedTenantQueueBody.items).toEqual([
      expect.objectContaining({
        status: 'REJECTED',
        reviewEvents: [
          expect.objectContaining({
            metadata: { reason: 'Required registration details were not verified.' },
          }),
        ],
      }),
    ]);

    const replayedTenantRefresh = await fetch(`${baseUrl}/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: pendingOwnerRefreshCookie,
        Origin: 'http://localhost:5173',
      },
    });
    expect(replayedTenantRefresh.status).toBe(401);
    const revokedTenantRefreshSession = await fetch(`${baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${pendingOwnerToken}` },
    });
    expect(revokedTenantRefreshSession.status).toBe(401);

    const replayedPlatformRefresh = await fetch(`${baseUrl}/platform/auth/refresh`, {
      method: 'POST',
      headers: {
        Cookie: platformRefreshCookie,
        Origin: 'http://localhost:5173',
      },
    });
    expect(replayedPlatformRefresh.status).toBe(401);
    const revokedPlatformRefreshSession = await fetch(`${baseUrl}/platform/me`, {
      headers: { Authorization: `Bearer ${platformAccessToken}` },
    });
    expect(revokedPlatformRefreshSession.status).toBe(401);

    const platformLoginWithoutMfa = await fetch(`${baseUrl}/platform/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: platformAdminEmail,
        password: platformAdminPassword,
      }),
    });
    expect(platformLoginWithoutMfa.status).toBe(401);

    const platformLoginWithMfa = await fetch(`${baseUrl}/platform/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: platformAdminEmail,
        password: platformAdminPassword,
        mfaCode: createTotpCode(platformMfaSetupBody.secret),
      }),
    });
    expect(platformLoginWithMfa.status).toBe(200);
    const platformLoginWithMfaBody = (await platformLoginWithMfa.json()) as {
      accessToken?: string;
    };
    if (!platformLoginWithMfaBody.accessToken) {
      throw new Error('Platform MFA login did not create an authenticated session.');
    }

    const platformLogout = await fetch(`${baseUrl}/platform/auth/logout`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${platformLoginWithMfaBody.accessToken}` },
    });
    expect(platformLogout.status).toBe(200);
    expect(await platformLogout.json()).toEqual({ loggedOut: true });
    const loggedOutPlatformSession = await fetch(`${baseUrl}/platform/me`, {
      headers: { Authorization: `Bearer ${platformLoginWithMfaBody.accessToken}` },
    });
    expect(loggedOutPlatformSession.status).toBe(401);
  });
});
