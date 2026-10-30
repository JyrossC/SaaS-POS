import { PrismaService } from '../database/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  const transaction = {
    product: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  const prisma = {
    $transaction: jest.fn(),
    product: { findMany: jest.fn(), count: jest.fn(), findFirst: jest.fn() },
  };
  let service: ProductsService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.$transaction.mockImplementation(async (callback: (tx: typeof transaction) => unknown) => {
      if (typeof callback === 'function') {
        return callback(transaction);
      }
      return Promise.all(callback);
    });
    service = new ProductsService(prisma as unknown as PrismaService);
  });

  it('creates a tenant-scoped product and audit event in one transaction', async () => {
    transaction.product.create.mockResolvedValue({
      id: 'product-1',
      tenantId: 'tenant-1',
      sku: 'SKU-01',
      sellingPrice: '12.5000',
    });
    transaction.auditLog.create.mockResolvedValue({});

    const product = await service.create(
      'tenant-1',
      {
        id: 'user-1',
        membershipId: 'membership-1',
        tenantId: 'tenant-1',
        email: 'owner@example.com',
        role: 'Tenant Owner',
        roleNames: ['Tenant Owner'],
        permissions: ['products.create'],
        storeIds: [],
        allStoreAccess: true,
      },
      {
        sku: ' SKU-01 ',
        name: ' Tea ',
        baseUnit: 'each',
        sellingPrice: '12.5000',
      },
    );

    expect(transaction.product.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          sku: 'SKU-01',
          name: 'Tea',
          sellingPrice: expect.anything(),
        }),
      }),
    );
    expect(transaction.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          tenantId: 'tenant-1',
          actorUserId: 'user-1',
          resourceId: 'product-1',
        }),
      }),
    );
    expect(product.id).toBe('product-1');
  });

  it('scopes product search by tenant and supports an empty catalogue', async () => {
    prisma.product.findMany.mockResolvedValue([]);
    prisma.product.count.mockResolvedValue(0);

    const result = await service.list('tenant-1', {
      search: ' tea ',
      page: 1,
      pageSize: 25,
      includeArchived: false,
    });

    expect(prisma.product.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ tenantId: 'tenant-1', isActive: true }),
      }),
    );
    expect(result).toEqual({ items: [], page: 1, pageSize: 25, total: 0 });
  });
});
