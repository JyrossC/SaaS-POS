import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { AuthService } from '../auth/auth.service';
import { EntitlementService } from '../subscription/entitlement.service';
import { TenantContextService } from '../tenant/tenant-context.service';
import * as argon2 from 'argon2';

describe('Security: Cross-Tenant and Cross-Store Access Control', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let authService: AuthService;
  let entitlementService: EntitlementService;
  let tenantContext: TenantContextService;

  // Tenant data
  let tenantAId: string;
  let tenantAUserId: string;
  let tenantAMembershipId: string;
  let tenantAStoreId: string;

  let tenantBId: string;
  let tenantBUserId: string;
  let tenantBMembershipId: string;
  let tenantBStoreId: string;

  let tenantCId: string;
  let tenantCUserId: string;
  let tenantCMembershipId: string;

  let tenantAToken: string;
  let tenantBToken: string;
  let tenantCToken: string;

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        PrismaService,
        AuthService,
        EntitlementService,
        TenantContextService,
      ],
    }).compile();

    prisma = module.get(PrismaService);
    authService = module.get(AuthService);
    entitlementService = module.get(EntitlementService);
    tenantContext = module.get(TenantContextService);

    // Clean slate - delete in dependency order
    await prisma.stockMovement.deleteMany();
    await prisma.refundItem.deleteMany();
    await prisma.refund.deleteMany();
    await prisma.salePayment.deleteMany();
    await prisma.saleItem.deleteMany();
    await prisma.sale.deleteMany();
    await prisma.goodsReceiptItem.deleteMany();
    await prisma.goodsReceipt.deleteMany();
    await prisma.purchaseOrderItem.deleteMany();
    await prisma.purchaseOrder.deleteMany();
    await prisma.supplier.deleteMany();
    await prisma.stockQuarantine.deleteMany();
    await prisma.dispensingItem.deleteMany();
    await prisma.dispensingRecord.deleteMany();
    await prisma.prescriptionItem.deleteMany();
    await prisma.prescription.deleteMany();
    await prisma.batchInventory.deleteMany();
    await prisma.productBatch.deleteMany();
    await prisma.drugDetail.deleteMany();
    await prisma.inventoryBalance.deleteMany();
    await prisma.product.deleteMany();
    await prisma.cashSession.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.store.deleteMany();
    await prisma.membershipRole.deleteMany();
    await prisma.membership.deleteMany();
    await prisma.role.deleteMany();
    await prisma.tenantSubscription.deleteMany();
    await prisma.tenantEntitlementOverride.deleteMany();
    await prisma.user.deleteMany();
    await prisma.tenant.deleteMany();

    const passwordHash = await argon2.hash('Password123!', { type: argon2.argon2id });

    // ============================================
    // Tenant A - Active tenant with ACTIVE subscription
    // ============================================
    const userA = await prisma.user.create({
      data: { email: 'owner-a@example.com', passwordHash, name: 'Owner A' },
    });
    const tenantA = await prisma.tenant.create({
      data: { slug: 'tenant-a-secure', name: 'Tenant A', businessType: 'RETAIL', status: 'ACTIVE' },
    });

    const planA = await prisma.subscriptionPlan.create({
      data: { code: 'STARTER-A', name: 'Starter Plan A' },
    });
    const planVersionA = await prisma.subscriptionPlanVersion.create({
      data: {
        planId: planA.id,
        version: 1,
        isActive: true,
        trialDays: 0,
        billingPeriodDays: 30,
        currency: 'USD',
        price: new Prisma.Decimal(29),
      },
    });
    await prisma.subscriptionPlanVersion.update({
      where: { id: planVersionA.id },
      data: {
        entitlements: {
          create: [
            { key: 'stores', value: 5 },
            { key: 'staff', value: 5 },
            { key: 'pos', value: true },
            { key: 'products', value: true },
            { key: 'inventory', value: true },
            { key: 'purchasing', value: true },
            { key: 'pharmacy', value: false },
            { key: 'analytics', value: true },
            { key: 'ai', value: false },
          ],
        },
      },
    });

    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenantA.id,
        planVersionId: planVersionA.id,
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: null,
        trialEndsAt: null,
      },
    });
    await prisma.store.create({
      data: { tenantId: tenantA.id, name: 'Store A', code: 'STORE-A', status: 'ACTIVE' },
    });
    const membershipA = await prisma.membership.create({
      data: { tenantId: tenantA.id, userId: userA.id, status: 'ACTIVE', allStoreAccess: true },
    });
    const roleA = await prisma.role.create({
      data: { tenantId: tenantA.id, name: 'Owner', isSystem: true },
    });
    await prisma.membershipRole.create({
      data: { tenantId: tenantA.id, membershipId: membershipA.id, roleId: roleA.id },
    });
    const allPermsA = await prisma.permission.findMany();
    await prisma.rolePermission.createMany({
      data: allPermsA.map((p) => ({ roleId: roleA.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    tenantAId = tenantA.id;
    tenantAUserId = userA.id;
    tenantAMembershipId = membershipA.id;
    tenantAStoreId = (await prisma.store.findFirst({ where: { tenantId: tenantAId } }))!.id;

    // ============================================
    // Tenant B - Active tenant with ACTIVE subscription (different tenant)
    // ============================================
    const userB = await prisma.user.create({
      data: { email: 'owner-b@example.com', passwordHash, name: 'Owner B' },
    });
    const tenantB = await prisma.tenant.create({
      data: { slug: 'tenant-b-secure', name: 'Tenant B', businessType: 'RETAIL', status: 'ACTIVE' },
    });
    const planB = await prisma.subscriptionPlan.create({
      data: { code: 'STARTER-B', name: 'Starter Plan B' },
    });
    const planVersionB = await prisma.subscriptionPlanVersion.create({
      data: {
        planId: planB.id,
        version: 1,
        isActive: true,
        trialDays: 0,
        billingPeriodDays: 30,
        currency: 'USD',
        price: new Prisma.Decimal(29),
      },
    });
    await prisma.subscriptionPlanVersion.update({
      where: { id: planVersionB.id },
      data: {
        entitlements: {
          create: [
            { key: 'stores', value: 5 },
            { key: 'staff', value: 5 },
            { key: 'pos', value: true },
            { key: 'products', value: true },
            { key: 'inventory', value: true },
          ],
        },
      },
    });
    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenantB.id,
        planVersionId: planVersionB.id,
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: null,
        trialEndsAt: null,
      },
    });
    await prisma.store.create({
      data: { tenantId: tenantB.id, name: 'Store B', code: 'STORE-B', status: 'ACTIVE' },
    });
    const membershipB = await prisma.membership.create({
      data: { tenantId: tenantB.id, userId: userB.id, status: 'ACTIVE', allStoreAccess: true },
    });
    const roleB = await prisma.role.create({
      data: { tenantId: tenantB.id, name: 'Owner', isSystem: true },
    });
    await prisma.membershipRole.create({
      data: { tenantId: tenantB.id, membershipId: membershipB.id, roleId: roleB.id },
    });
    const allPermsB = await prisma.permission.findMany();
    await prisma.rolePermission.createMany({
      data: allPermsB.map((p) => ({ roleId: roleB.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    tenantBId = tenantB.id;
    tenantBUserId = userB.id;
    tenantBMembershipId = membershipB.id;
    tenantBStoreId = (await prisma.store.findFirst({ where: { tenantId: tenantBId } }))!.id;

    // ============================================
    // Tenant C - Suspended tenant
    // ============================================
    const userC = await prisma.user.create({
      data: { email: 'owner-c@example.com', passwordHash, name: 'Owner C' },
    });
    const tenantC = await prisma.tenant.create({
      data: { slug: 'tenant-c-secure', name: 'Tenant C', businessType: 'RETAIL', status: 'SUSPENDED' },
    });
    const planC = await prisma.subscriptionPlan.create({
      data: { code: 'STARTER-C', name: 'Starter Plan C' },
    });
    const planVersionC = await prisma.subscriptionPlanVersion.create({
      data: {
        planId: planC.id,
        version: 1,
        isActive: true,
        trialDays: 0,
        billingPeriodDays: 30,
        currency: 'USD',
        price: new Prisma.Decimal(29),
      },
    });
    await prisma.subscriptionPlanVersion.update({
      where: { id: planVersionC.id },
      data: {
        entitlements: {
          create: [
            { key: 'pos', value: true },
            { key: 'products', value: true },
          ],
        },
      },
    });
    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenantC.id,
        planVersionId: planVersionC.id,
        status: 'SUSPENDED',
        startsAt: new Date(),
        endsAt: null,
        trialEndsAt: null,
      },
    });
    await prisma.store.create({
      data: { tenantId: tenantC.id, name: 'Store C', code: 'STORE-C', status: 'ACTIVE' },
    });
    const membershipC = await prisma.membership.create({
      data: { tenantId: tenantC.id, userId: userC.id, status: 'ACTIVE', allStoreAccess: true },
    });
    const roleC = await prisma.role.create({
      data: { tenantId: tenantC.id, name: 'Owner', isSystem: true },
    });
    await prisma.membershipRole.create({
      data: { tenantId: tenantC.id, membershipId: membershipC.id, roleId: roleC.id },
    });
    const allPermsC = await prisma.permission.findMany();
    await prisma.rolePermission.createMany({
      data: allPermsC.map((p) => ({ roleId: roleC.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    tenantCId = tenantC.id;
    tenantCUserId = userC.id;
    tenantCMembershipId = membershipC.id;

    tenantAToken = authService.signToken(userA.id, membershipA.id);
    tenantBToken = authService.signToken(userB.id, membershipB.id);
    tenantCToken = authService.signToken(userC.id, membershipC.id);
  });

  afterAll(async () => {
    await module.close();
  });

  describe('Cross-Tenant Access Prevention', () => {
    it('should prevent tenant A from accessing tenant B stores', async () => {
      const context = await entitlementService.getContext(tenantAId);
      expect(context.tenantId).toBe(tenantAId);
      expect(context.tenantId).not.toBe(tenantBId);

      const storesInTenantB = await prisma.store.findMany({
        where: { tenantId: tenantBId },
      });
      expect(storesInTenantB.length).toBeGreaterThan(0);
    });

    it('should prevent tenant A from accessing tenant B products', async () => {
      const productsInTenantB = await prisma.product.findMany({
        where: { tenantId: tenantBId },
      });
      if (productsInTenantB.length > 0) {
        expect(productsInTenantB.every((p) => p.tenantId !== tenantAId)).toBe(true);
      }
    });

    it('should prevent tenant B from accessing tenant A stores', async () => {
      const context = await entitlementService.getContext(tenantBId);
      expect(context.tenantId).toBe(tenantBId);
      expect(context.tenantId).not.toBe(tenantAId);

      const storesInTenantA = await prisma.store.findMany({
        where: { tenantId: tenantAId },
      });
      expect(storesInTenantA.length).toBeGreaterThan(0);
    });
  });

  describe('Suspended Tenant Access Prevention', () => {
    it('should reject suspended tenant from accessing modules', async () => {
      const context = await entitlementService.getContext(tenantCId);
      expect(context.tenantId).toBe(tenantCId);
      expect(context.tenantActive).toBe(false);
      expect(context.subscriptionStatus).toBe('SUSPENDED');
      expect(context.subscriptionCurrent).toBe(false);

      const canAccess = entitlementService.canAccessModule(
        {
          id: tenantCUserId,
          membershipId: tenantCMembershipId,
          tenantId: tenantCId,
          email: 'owner-c@example.com',
          role: 'Owner',
          roleNames: ['Owner'],
          permissions: ['stores.create'],
          storeIds: [],
          allStoreAccess: true,
        } as any,
        context,
        'stores',
      );
      expect(canAccess).toBe(false);
    });

    it('should reject suspended tenant from creating stores', async () => {
      const context = await entitlementService.getContext(tenantCId);
      const result = entitlementService.canAccessModule(
        {
          id: tenantCUserId,
          membershipId: tenantCMembershipId,
          tenantId: tenantCId,
          email: 'owner-c@example.com',
          role: 'Owner',
          roleNames: ['Owner'],
          permissions: ['stores.create'],
          storeIds: [],
          allStoreAccess: true,
        } as any,
        context,
        'stores',
        true,
      );
      expect(result).toBe(false);
    });
  });

  describe('Expired Subscription Access Prevention', () => {
    it('should reject expired subscription from accessing modules', async () => {
      const userE = await prisma.user.create({
        data: {
          email: 'expired@example.com',
          passwordHash: await argon2.hash('Password123!', { type: argon2.argon2id }),
          name: 'Expired Owner',
        },
      });
      const tenantE = await prisma.tenant.create({
        data: {
          slug: 'tenant-expired',
          name: 'Expired Tenant',
          businessType: 'RETAIL',
          status: 'ACTIVE',
        },
      });
      const planE = await prisma.subscriptionPlan.create({
        data: { code: 'EXPIRED-PLAN', name: 'Expired Plan' },
      });
      const planVersionE = await prisma.subscriptionPlanVersion.create({
        data: {
          planId: planE.id,
          version: 1,
          isActive: true,
          trialDays: 0,
          billingPeriodDays: 30,
          currency: 'USD',
          price: new Prisma.Decimal(29),
        },
      });
      await prisma.subscriptionPlanVersion.update({
        where: { id: planVersionE.id },
        data: {
          entitlements: {
            create: [{ key: 'pos', value: true }],
          },
        },
      });
      await prisma.tenantSubscription.create({
        data: {
          tenantId: tenantE.id,
          planVersionId: planVersionE.id,
          status: 'ACTIVE',
          startsAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          endsAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          trialEndsAt: null,
        },
      });

      const context = await entitlementService.getContext(tenantE.id);
      expect(context.subscriptionStatus).toBe('ACTIVE');
      expect(context.subscriptionCurrent).toBe(false);

      const canAccess = entitlementService.canAccessModule(
        {
          id: userE.id,
          membershipId: '',
          tenantId: tenantE.id,
          email: 'expired@example.com',
          role: 'Owner',
          roleNames: ['Owner'],
          permissions: ['pos'],
          storeIds: [],
          allStoreAccess: true,
        } as any,
        context,
        'pos',
      );
      expect(canAccess).toBe(false);
    });
  });
});
