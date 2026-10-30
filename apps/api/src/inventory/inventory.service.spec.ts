import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const transaction = {
    stockMovement: { findUnique: jest.fn(), create: jest.fn() },
    store: { findFirst: jest.fn() },
    product: { findFirst: jest.fn() },
    inventoryBalance: {
      upsert: jest.fn(),
      updateMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    stockMovement: { findUnique: jest.fn() },
    inventoryBalance: { findMany: jest.fn() },
  };
  const actor: AuthenticatedUser = {
    id: 'user-1',
    membershipId: 'membership-1',
    tenantId: 'tenant-1',
    email: 'manager@example.com',
    role: 'Store Manager',
    roleNames: ['Store Manager'],
    permissions: ['inventory.adjust'],
    storeIds: ['store-1'],
    allStoreAccess: false,
  };
  let service: InventoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof transaction) => unknown) =>
      callback(transaction),
    );
    transaction.stockMovement.findUnique.mockResolvedValue(null);
    transaction.store.findFirst.mockResolvedValue({ id: 'store-1' });
    transaction.product.findFirst.mockResolvedValue({ id: 'product-1' });
    transaction.inventoryBalance.upsert.mockResolvedValue({});
    transaction.inventoryBalance.updateMany.mockResolvedValue({ count: 1 });
    transaction.stockMovement.create.mockResolvedValue({
      id: 'movement-1',
      tenantId: 'tenant-1',
      storeId: 'store-1',
      productId: 'product-1',
      quantityDelta: new Prisma.Decimal('2'),
      reason: 'opening count',
    });
    transaction.inventoryBalance.findUniqueOrThrow.mockResolvedValue({
      quantityOnHand: new Prisma.Decimal('2'),
    });
    transaction.auditLog.create.mockResolvedValue({});
    service = new InventoryService(prisma as unknown as PrismaService);
  });

  it('records a positive adjustment, balance, and audit atomically', async () => {
    const result = await service.adjustStock(
      'tenant-1',
      'store-1',
      actor,
      { productId: 'product-1', quantityDelta: '2', reason: 'opening count' },
      'request-1',
    );

    expect(transaction.inventoryBalance.upsert).toHaveBeenCalled();
    expect(transaction.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          actorMembershipId: 'membership-1',
          idempotencyKey: 'request-1',
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalled();
    expect(result.replayed).toBe(false);
  });

  it('rejects a decrement that would make stock negative without writing a movement', async () => {
    transaction.inventoryBalance.updateMany.mockResolvedValue({ count: 0 });

    await expect(
      service.adjustStock(
        'tenant-1',
        'store-1',
        actor,
        { productId: 'product-1', quantityDelta: '-3', reason: 'correction' },
        'request-2',
      ),
    ).rejects.toThrow(ConflictException);
    expect(transaction.stockMovement.create).not.toHaveBeenCalled();
    expect(transaction.auditLog.create).not.toHaveBeenCalled();
  });

  it('rejects a product that does not belong to the requested tenant', async () => {
    transaction.product.findFirst.mockResolvedValue(null);

    await expect(
      service.adjustStock(
        'tenant-1',
        'store-1',
        actor,
        { productId: 'foreign-product', quantityDelta: '1', reason: 'receipt' },
        'request-3',
      ),
    ).rejects.toThrow(NotFoundException);
    expect(transaction.inventoryBalance.upsert).not.toHaveBeenCalled();
  });

  it('returns the original movement when the same request is retried', async () => {
    transaction.stockMovement.findUnique.mockResolvedValue({
      id: 'movement-1',
      storeId: 'store-1',
      productId: 'product-1',
      quantityDelta: new Prisma.Decimal('2'),
      reason: 'opening count',
    });

    const result = await service.adjustStock(
      'tenant-1',
      'store-1',
      actor,
      { productId: 'product-1', quantityDelta: '2.0000', reason: 'opening count' },
      'request-1',
    );

    expect(result.replayed).toBe(true);
    expect(transaction.inventoryBalance.upsert).not.toHaveBeenCalled();
  });
});
