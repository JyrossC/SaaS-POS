import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../database/prisma.service';
import { Prisma } from '@prisma/client';
import { PharmacyService } from '../pharmacy/pharmacy.service';
import { SalesService } from '../sales/sales.service';
import { ReturnsService } from '../sales/returns.service';
import { EntitlementService } from '../subscription/entitlement.service';
import * as argon2 from 'argon2';

describe('Pharmacy: Safety and Traceability Tests', () => {
  let module: TestingModule;
  let prisma: PrismaService;
  let pharmacyService: PharmacyService;
  let salesService: SalesService;
  let returnsService: ReturnsService;
  let entitlementService: EntitlementService;

  let tenantId: string;
  let storeId: string;
  let userId: string;
  let membershipId: string;
  let productId: string;
  let batchId1: string;
  let batchId2: string;

  const futureDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    return d;
  };

  const pastDate = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d;
  };

  beforeAll(async () => {
    module = await Test.createTestingModule({
      providers: [
        PrismaService,
        PharmacyService,
        SalesService,
        ReturnsService,
        EntitlementService,
      ],
    }).compile();

    prisma = module.get(PrismaService);
    pharmacyService = module.get(PharmacyService);
    salesService = module.get(SalesService);
    returnsService = module.get(ReturnsService);
    entitlementService = module.get(EntitlementService);

    // Clean slate
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

    const user = await prisma.user.create({
      data: { email: 'pharmacy-owner@example.com', passwordHash, name: 'Pharmacy Owner' },
    });
    const tenant = await prisma.tenant.create({
      data: {
        slug: 'pharmacy-tenant',
        name: 'Pharmacy Tenant',
        businessType: 'PHARMACY',
        status: 'ACTIVE',
      },
    });
    const plan = await prisma.subscriptionPlan.create({
      data: { code: 'PHARMACY-PLAN', name: 'Pharmacy Plan' },
    });
    const planVersion = await prisma.subscriptionPlanVersion.create({
      data: {
        planId: plan.id,
        version: 1,
        isActive: true,
        trialDays: 0,
        billingPeriodDays: 30,
        currency: 'USD',
        price: new Prisma.Decimal(49),
      },
    });
    await prisma.subscriptionPlanVersion.update({
      where: { id: planVersion.id },
      data: {
        entitlements: {
          create: [
            { key: 'stores', value: 5 },
            { key: 'staff', value: 10 },
            { key: 'pos', value: true },
            { key: 'products', value: true },
            { key: 'inventory', value: true },
            { key: 'purchasing', value: true },
            { key: 'pharmacy', value: true },
            { key: 'analytics', value: true },
            { key: 'ai', value: false },
          ],
        },
      },
    });
    await prisma.tenantSubscription.create({
      data: {
        tenantId: tenant.id,
        planVersionId: planVersion.id,
        status: 'ACTIVE',
        startsAt: new Date(),
        endsAt: null,
        trialEndsAt: null,
      },
    });
    const store = await prisma.store.create({
      data: { tenantId: tenant.id, name: 'Main Store', code: 'MAIN', status: 'ACTIVE' },
    });
    const membership = await prisma.membership.create({
      data: {
        tenantId: tenant.id,
        userId: user.id,
        status: 'ACTIVE',
        allStoreAccess: true,
      },
    });
    const role = await prisma.role.create({
      data: { tenantId: tenant.id, name: 'Owner', isSystem: true },
    });
    await prisma.membershipRole.create({
      data: { tenantId: tenant.id, membershipId: membership.id, roleId: role.id },
    });
    const allPerms = await prisma.permission.findMany();
    await prisma.rolePermission.createMany({
      data: allPerms.map((p) => ({ roleId: role.id, permissionId: p.id })),
      skipDuplicates: true,
    });

    tenantId = tenant.id;
    storeId = store.id;
    userId = user.id;
    membershipId = membership.id;

    // Create a pharmacy product with drug details
    const product = await prisma.product.create({
      data: {
        tenantId,
        sku: 'DRUG-001',
        name: 'Amoxicillin 500mg',
        baseUnit: 'tablet',
        sellingPrice: new Prisma.Decimal('15.00'),
        costPrice: new Prisma.Decimal('5.00'),
        isActive: true,
        drugDetails: {
          create: {
            genericName: 'Amoxicillin',
            brandName: 'Amoxil',
            strength: '500mg',
            dosageForm: 'tablet',
            prescriptionRequired: true,
          },
        },
      },
      include: { drugDetails: true },
    });
    productId = product.id;

    // Create two batches: one expiring sooner (FEFO), one later
    const batch1 = await prisma.productBatch.create({
      data: {
        tenantId,
        productId,
        batchNumber: 'BATCH-A-2027',
        expiresAt: futureDate(30),
        quantityReceived: new Prisma.Decimal(100),
        costPerUnit: new Prisma.Decimal('5.00'),
      },
    });
    await prisma.batchInventory.create({
      data: { tenantId, storeId, batchId: batch1.id, quantityOnHand: new Prisma.Decimal(100) },
    });
    batchId1 = batch1.id;

    const batch2 = await prisma.productBatch.create({
      data: {
        tenantId,
        productId,
        batchNumber: 'BATCH-B-2028',
        expiresAt: futureDate(90),
        quantityReceived: new Prisma.Decimal(100),
        costPerUnit: new Prisma.Decimal('5.00'),
      },
    });
    await prisma.batchInventory.create({
      data: { tenantId, storeId, batchId: batch2.id, quantityOnHand: new Prisma.Decimal(100) },
    });
    batchId2 = batch2.id;

    // Upsert aggregate inventory
    await prisma.inventoryBalance.upsert({
      where: {
        tenantId_storeId_productId: { tenantId, storeId, productId },
      },
      create: {
        tenantId,
        storeId,
        productId,
        quantityOnHand: new Prisma.Decimal(200),
      },
      update: {
        quantityOnHand: new Prisma.Decimal(200),
      },
    });
  });

  afterAll(async () => {
    await module.close();
  });

  describe('FEFO Allocation Ordering', () => {
    it('should allocate from earliest-expiry batch first', async () => {
      const allocation = await pharmacyService.allocateFEFO(
        tenantId,
        storeId,
        productId,
        new Prisma.Decimal(30),
      );
      expect(allocation.length).toBeGreaterThan(0);
      expect(allocation[0].batchId).toBe(batchId1);
      expect(allocation[0].quantity).toEqual(new Prisma.Decimal(30));
    });

    it('should move to second batch when first is exhausted', async () => {
      // First deplete batch1
      await pharmacyService.allocateFEFO(
        tenantId,
        storeId,
        productId,
        new Prisma.Decimal(100),
      );
      // Verify batch1 is depleted
      const batch1Inv = await prisma.batchInventory.findFirst({
        where: { tenantId, batchId: batchId1 },
      });
      expect(batch1Inv!.quantityOnHand).toEqual(new Prisma.Decimal(0));

      // Now allocation should come from batch2
      const allocation = await pharmacyService.allocateFEFO(
        tenantId,
        storeId,
        productId,
        new Prisma.Decimal(30),
      );
      expect(allocation[0].batchId).toBe(batchId2);
    });

    it('should reject allocation when insufficient non-expired stock', async () => {
      await expect(
        pharmacyService.allocateFEFO(
          tenantId,
          storeId,
          productId,
          new Prisma.Decimal(999),
        ),
      ).rejects.toThrow(/Insufficient non-expired stock/);
    });
  });

  describe('Expiry Boundaries', () => {
    it('should not allocate expired batches', async () => {
      // Create an expired batch
      const expiredBatch = await prisma.productBatch.create({
        data: {
          tenantId,
          productId,
          batchNumber: 'EXPIRED-2026',
          expiresAt: pastDate(5),
          quantityReceived: new Prisma.Decimal(50),
          costPerUnit: new Prisma.Decimal('5.00'),
        },
      });
      await prisma.batchInventory.create({
        data: {
          tenantId,
          storeId,
          batchId: expiredBatch.id,
          quantityOnHand: new Prisma.Decimal(50),
        },
      });

      // Allocation should not include the expired batch
      const allocation = await pharmacyService.allocateFEFO(
        tenantId,
        storeId,
        productId,
        new Prisma.Decimal(10),
      );
      expect(allocation.some((a) => a.batchId === expiredBatch.id)).toBe(false);
    });

    it('should not allocate batches expiring today', async () => {
      const expiringToday = await prisma.productBatch.create({
        data: {
          tenantId,
          productId,
          batchNumber: 'EXPIRES-TODAY',
          expiresAt: new Date(),
          quantityReceived: new Prisma.Decimal(50),
          costPerUnit: new Prisma.Decimal('5.00'),
        },
      });
      await prisma.batchInventory.create({
        data: {
          tenantId,
          storeId,
          batchId: expiringToday.id,
          quantityOnHand: new Prisma.Decimal(50),
        },
      });

      const allocation = await pharmacyService.allocateFEFO(
        tenantId,
        storeId,
        productId,
        new Prisma.Decimal(10),
      );
      expect(allocation.some((a) => a.batchId === expiringToday.id)).toBe(false);
    });
  });

  describe('Quarantine Exclusion', () => {
    it('should not allocate quarantined batches through FEFO', async () => {
      // Quarantine batch2
      await prisma.stockQuarantine.create({
        data: {
          tenantId,
          storeId,
          batchId: batchId2,
          quantity: new Prisma.Decimal(50),
          reason: 'Quality issue',
          quarantinedByMembershipId: membershipId,
        },
      });
      // Decrement batch2 inventory to reflect quarantine
      await prisma.batchInventory.update({
        where: { id: batchId2 },
        data: { quantityOnHand: { decrement: new Prisma.Decimal(50) } },
      });

      // Allocate 60 units: should only get from batch1 (which has 100 remaining after earlier allocations)
      // But wait - earlier tests may have modified batch1. Let's check what's available.
      const batch1Inv = await prisma.batchInventory.findFirst({
        where: { tenantId, batchId: batchId1 },
      });
      const batch2Inv = await prisma.batchInventory.findFirst({
        where: { tenantId, batchId: batchId2 },
      });

      const allocation = await pharmacyService.allocateFEFO(
        tenantId,
        storeId,
        productId,
        new Prisma.Decimal(batch1Inv!.quantityOnHand),
      );
      // Should NOT include quarantined batch2
      expect(allocation.some((a) => a.batchId === batchId2)).toBe(false);
    });
  });

  describe('Batch Depletion', () => {
    it('should prevent dispensing more than available batch stock', async () => {
      // Reset batch inventory to known state
      await prisma.batchInventory.update({
        where: { id: batchId1 },
        data: { quantityOnHand: new Prisma.Decimal(10) },
      });
      await prisma.batchInventory.update({
        where: { id: batchId2 },
        data: { quantityOnHand: new Prisma.Decimal(10) },
      });
      await prisma.inventoryBalance.update({
        where: {
          tenantId_storeId_productId: { tenantId, storeId, productId },
        },
        data: { quantityOnHand: new Prisma.Decimal(20) },
      });

      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.dispensing.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      // Try to dispense 25 units (only 20 available across both batches)
      await expect(
        pharmacyService.dispense(tenantId, actor, {
          storeId,
          items: [{ productId, quantity: '25' }],
        }),
      ).rejects.toThrow(/Insufficient non-expired stock/);
    });

    it('should successfully dispense within available stock', async () => {
      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.dispensing.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      const result = await pharmacyService.dispense(tenantId, actor, {
        storeId,
        items: [{ productId, quantity: '15' }],
      });
      expect(result).toBeDefined();
      expect(result!.items.length).toBeGreaterThan(0);

      // Verify batch inventory was decremented
      const remainingTotal = await prisma.batchInventory.aggregate({
        where: { tenantId, storeId, batch: { productId } },
        _sum: { quantityOnHand: true },
      });
      expect(remainingTotal._sum?.quantityOnHand?.toNumber()).toBeLessThanOrEqual(5);
    });
  });

  describe('Quarantine and Release', () => {
    it('should quarantine stock and remove from available inventory', async () => {
      // Reset inventory
      await prisma.batchInventory.update({
        where: { id: batchId1 },
        data: { quantityOnHand: new Prisma.Decimal(50) },
      });
      await prisma.inventoryBalance.update({
        where: {
          tenantId_storeId_productId: { tenantId, storeId, productId },
        },
        data: { quantityOnHand: new Prisma.Decimal(50) },
      });

      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.batches.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      const quarantine = await pharmacyService.quarantineStock(tenantId, actor, {
        storeId,
        batchId: batchId1,
        quantity: '20',
        reason: 'Quality control',
      });
      expect(quarantine).toBeDefined();

      // Verify batch inventory decremented
      const batchInv = await prisma.batchInventory.findFirst({
        where: { tenantId, batchId: batchId1 },
      });
      expect(batchInv!.quantityOnHand).toEqual(new Prisma.Decimal(30));
    });

    it('should release quarantined stock and restore inventory', async () => {
      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.batches.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      // Find active quarantine
      const quarantine = await prisma.stockQuarantine.findFirst({
        where: { tenantId, batchId: batchId1, releasedAt: null },
      });
      expect(quarantine).toBeDefined();

      await pharmacyService.releaseQuarantine(tenantId, quarantine!.id, actor);

      // Verify batch inventory restored
      const batchInv = await prisma.batchInventory.findFirst({
        where: { tenantId, batchId: batchId1 },
      });
      expect(batchInv!.quantityOnHand).toEqual(new Prisma.Decimal(50));

      // Verify quarantine is released
      const released = await prisma.stockQuarantine.findFirst({
        where: { id: quarantine!.id },
      });
      expect(released!.releasedAt).not.toBeNull();
    });
  });

  describe('Prescription Management', () => {
    it('should create a prescription with items', async () => {
      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.batches.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      const prescription = await pharmacyService.createPrescription(tenantId, actor, {
        storeId,
        patientName: 'John Doe',
        prescriberName: 'Dr. Smith',
        prescriberLicense: 'MD-12345',
        items: [
          { productId, quantityPrescribed: '30' },
        ],
      });

      expect(prescription).toBeDefined();
      expect(prescription!.status).toBe('ACTIVE');
      expect(prescription!.items.length).toBe(1);
      expect(prescription!.items[0].quantityPrescribed).toEqual(new Prisma.Decimal(30));
      expect(prescription!.items[0].quantityDispensed).toEqual(new Prisma.Decimal(0));
    });

    it('should reject prescription with non-positive quantity', async () => {
      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.batches.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      await expect(
        pharmacyService.createPrescription(tenantId, actor, {
          storeId,
          patientName: 'Jane Doe',
          items: [
            { productId, quantityPrescribed: '0' },
          ],
        }),
      ).rejects.toThrow(/Prescribed quantity must be positive/);
    });
  });

  describe('Prescription Dispensing Validation', () => {
    it('should dispense against a prescription and track quantity', async () => {
      // Reset inventory
      await prisma.batchInventory.update({
        where: { id: batchId1 },
        data: { quantityOnHand: new Prisma.Decimal(100) },
      });
      await prisma.inventoryBalance.update({
        where: {
          tenantId_storeId_productId: { tenantId, storeId, productId },
        },
        data: { quantityOnHand: new Prisma.Decimal(100) },
      });

      // Create a prescription
      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.dispensing.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      const prescription = await pharmacyService.createPrescription(tenantId, actor, {
        storeId,
        patientName: 'Rx Patient',
        prescriberName: 'Dr. Smith',
        items: [{ productId, quantityPrescribed: '20' }],
      });

      // Dispense 10 units against the prescription
      const result = await pharmacyService.dispense(tenantId, actor, {
        storeId,
        prescriptionId: prescription!.id,
        items: [{ productId, quantity: '10' }],
      });
      expect(result).toBeDefined();

      // Verify prescription item quantityDispensed updated
      const rxItem = await prisma.prescriptionItem.findFirst({
        where: { prescriptionId: prescription!.id, productId },
      });
      expect(rxItem!.quantityDispensed).toEqual(new Prisma.Decimal(10));

      // Dispense another 10 units (completing the prescription)
      await pharmacyService.dispense(tenantId, actor, {
        storeId,
        prescriptionId: prescription!.id,
        items: [{ productId, quantity: '10' }],
      });

      // Verify prescription is now COMPLETED
      const updatedRx = await prisma.prescription.findFirst({
        where: { id: prescription!.id },
      });
      expect(updatedRx!.status).toBe('COMPLETED');
    });

    it('should reject dispensing beyond prescribed quantity', async () => {
      // Create a new prescription for 5 units
      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.dispensing.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      const prescription = await pharmacyService.createPrescription(tenantId, actor, {
        storeId,
        patientName: 'Rx Patient 2',
        items: [{ productId, quantityPrescribed: '5' }],
      });

      // Reset inventory for this test
      await prisma.batchInventory.update({
        where: { id: batchId1 },
        data: { quantityOnHand: new Prisma.Decimal(100) },
      });

      // Try to dispense 10 units against a 5-unit prescription
      await expect(
        pharmacyService.dispense(tenantId, actor, {
          storeId,
          prescriptionId: prescription!.id,
          items: [{ productId, quantity: '10' }],
        }),
      ).rejects.toThrow(/exceeds remaining prescribed quantity/);
    });

    it('should reject dispensing prescription-required product without prescription', async () => {
      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['pharmacy.dispensing.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      // Reset inventory
      await prisma.batchInventory.update({
        where: { id: batchId1 },
        data: { quantityOnHand: new Prisma.Decimal(100) },
      });

      // Try to dispense without prescriptionId for a prescription-required product
      await expect(
        pharmacyService.dispense(tenantId, actor, {
          storeId,
          items: [{ productId, quantity: '5' }],
        }),
      ).rejects.toThrow(/requires a valid prescription/);
    });
  });

  describe('Sale Path Pharmacy Restrictions', () => {
    it('should prevent sale of expired batch stock through POS', async () => {
      // Create an expired batch with stock
      const expiredBatch = await prisma.productBatch.create({
        data: {
          tenantId,
          productId,
          batchNumber: 'EXPIRED-SALE',
          expiresAt: pastDate(1),
          quantityReceived: new Prisma.Decimal(100),
          costPerUnit: new Prisma.Decimal('5.00'),
        },
      });
      await prisma.batchInventory.create({
        data: {
          tenantId,
          storeId,
          batchId: expiredBatch.id,
          quantityOnHand: new Prisma.Decimal(100),
        },
      });

      // Reset other batches to empty so only expired stock is available
      await prisma.batchInventory.update({
        where: { id: batchId1 },
        data: { quantityOnHand: new Prisma.Decimal(0) },
      });
      await prisma.batchInventory.update({
        where: { id: batchId2 },
        data: { quantityOnHand: new Prisma.Decimal(0) },
      });
      await prisma.inventoryBalance.update({
        where: {
          tenantId_storeId_productId: { tenantId, storeId, productId },
        },
        data: { quantityOnHand: new Prisma.Decimal(100) },
      });

      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['sales.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      // Sale should fail because only expired stock is available
      await expect(
        salesService.createSale(tenantId, actor, {
          storeId,
          items: [{ productId, quantity: '5' }],
          payments: [{ paymentMethod: 'cash', amount: '75.00' }],
          idempotencyKey: 'test-sale-expired-1',
        }),
      ).rejects.toThrow(/Insufficient non-expired stock/);
    });

    it('should complete sale using non-expired batch stock through POS', async () => {
      // Restore non-expired stock
      await prisma.batchInventory.update({
        where: { id: batchId1 },
        data: { quantityOnHand: new Prisma.Decimal(50) },
      });
      await prisma.inventoryBalance.update({
        where: {
          tenantId_storeId_productId: { tenantId, storeId, productId },
        },
        data: { quantityOnHand: new Prisma.Decimal(50) },
      });

      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['sales.create'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      const sale = await salesService.createSale(tenantId, actor, {
        storeId,
        items: [{ productId, quantity: '10' }],
        payments: [{ paymentMethod: 'cash', amount: '150.00' }],
        idempotencyKey: 'test-sale-pos-1',
      });
      expect(sale).toBeDefined();
      expect(sale!.items[0].batchId).not.toBeNull();
    });
  });

  describe('Return Restores Batch Inventory', () => {
    it('should restore batch inventory on pharmacy product return', async () => {
      // Create a sale with batch tracking
      const actor = {
        id: userId,
        membershipId,
        tenantId,
        email: 'pharmacy-owner@example.com',
        role: 'Owner',
        roleNames: ['Owner'],
        permissions: ['sales.create', 'sales.refund'],
        storeIds: [storeId],
        allStoreAccess: true,
      };

      // Ensure stock is available
      await prisma.batchInventory.update({
        where: { id: batchId1 },
        data: { quantityOnHand: new Prisma.Decimal(50) },
      });
      await prisma.inventoryBalance.update({
        where: {
          tenantId_storeId_productId: { tenantId, storeId, productId },
        },
        data: { quantityOnHand: new Prisma.Decimal(50) },
      });

      const sale = await salesService.createSale(tenantId, actor, {
        storeId,
        items: [{ productId, quantity: '10' }],
        payments: [{ paymentMethod: 'cash', amount: '150.00' }],
        idempotencyKey: 'test-return-batch-1',
      });

      const saleItemId = sale!.items[0].id;
      const batchId = sale!.items[0].batchId;
      expect(batchId).not.toBeNull();

      // Record batch inventory before return
      const batchBefore = await prisma.batchInventory.findFirst({
        where: { tenantId, batchId: batchId! },
      });

      // Process a refund
      const refund = await returnsService.createRefund(tenantId, actor, {
        saleId: sale!.id,
        reason: 'Customer return',
        items: [{ saleItemId, quantity: '5' }],
      });
      expect(refund).toBeDefined();

      // Verify batch inventory was restored by 5
      const batchAfter = await prisma.batchInventory.findFirst({
        where: { tenantId, batchId: batchId! },
      });
      expect(batchAfter!.quantityOnHand).toEqual(
        batchBefore!.quantityOnHand.add(new Prisma.Decimal(5)),
      );
    });
  });
});
