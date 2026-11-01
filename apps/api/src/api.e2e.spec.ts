import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AppModule } from './app.module';
import { PrismaService } from './database/prisma.service';
import { assertDedicatedTestDatabase } from './testing/test-database';

describe('API HTTP integration', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let baseUrl: string;
  let tenantSlug: string;
  let flowTenantSlug: string;
  let flowOwnerEmail: string;

  beforeAll(async () => {
    assertDedicatedTestDatabase();

    const module: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    prisma = module.get(PrismaService);

    await app.listen(0, '127.0.0.1');
    const address = app.getHttpServer().address();
    if (!address || typeof address === 'string') {
      throw new Error('The API test server did not bind to a TCP port.');
    }

    baseUrl = `http://127.0.0.1:${address.port}/api/v1`;
  });

  afterAll(async () => {
    if (tenantSlug && prisma) {
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          action: 'auth.login_failed',
          resource: 'authentication',
          metadata: { path: ['tenantSlug'], equals: tenantSlug },
        },
        select: { id: true },
      });
      if (auditLog) {
        await prisma.auditLog.delete({ where: { id: auditLog.id } });
      }
    }

    if (flowTenantSlug && flowOwnerEmail && prisma) {
      const tenant = await prisma.tenant.findUnique({
        where: { slug: flowTenantSlug },
        select: { id: true },
      });

      if (tenant) {
        await prisma.$transaction(async (tx) => {
          const roles = await tx.role.findMany({
            where: { tenantId: tenant.id },
            select: { id: true },
          });
          const roleIds = roles.map(({ id }) => id);

          await tx.auditLog.deleteMany({ where: { tenantId: tenant.id } });
          await tx.membershipRole.deleteMany({ where: { tenantId: tenant.id } });
          await tx.rolePermission.deleteMany({ where: { roleId: { in: roleIds } } });
          await tx.product.deleteMany({ where: { tenantId: tenant.id } });
          await tx.tenantSubscription.deleteMany({ where: { tenantId: tenant.id } });
          await tx.tenantModuleSetting.deleteMany({ where: { tenantId: tenant.id } });
          await tx.membership.deleteMany({ where: { tenantId: tenant.id } });
          await tx.role.deleteMany({ where: { tenantId: tenant.id } });
          await tx.tenant.delete({ where: { id: tenant.id } });
          await tx.user.deleteMany({ where: { email: flowOwnerEmail } });
        });
      }
    }

    if (app) {
      await app.close();
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
  });

  it('registers a tenant and creates and lists a product over HTTP', async () => {
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
      accessToken?: string;
      user?: { tenantId?: string };
    };
    const accessToken = registrationBody.accessToken;
    const tenantId = registrationBody.user?.tenantId;
    expect(accessToken).toEqual(expect.any(String));
    expect(tenantId).toEqual(expect.any(String));
    if (!accessToken || !tenantId) {
      throw new Error('Tenant registration did not return an authenticated principal.');
    }

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
        tenantId,
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

    const auditLog = await prisma.auditLog.findFirst({
      where: {
        tenantId,
        action: 'products.created',
        resourceId: product.id,
      },
    });
    expect(auditLog).not.toBeNull();
  });
});
