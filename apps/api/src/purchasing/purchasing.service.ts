import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export interface CreateSupplierInput {
  name: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
}

export interface UpdateSupplierInput {
  name?: string;
  contactName?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface ListSuppliersInput {
  search?: string;
  page: number;
  pageSize: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface CreatePurchaseOrderInput {
  storeId: string;
  supplierId: string;
  items: Array<{
    productId: string;
    quantityOrdered: string;
    unitCost: string;
  }>;
  notes?: string | null;
}

export interface ReceiveGoodsInput {
  storeId: string;
  purchaseOrderId?: string | null;
  items: Array<{
    productId: string;
    quantityReceived: string;
    unitCost: string;
  }>;
}

@Injectable()
export class PurchasingService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Supplier Management ---

  async createSupplier(tenantId: string, input: CreateSupplierInput) {
    const normalizedEmail = input.email?.trim().toLowerCase() || null;
    return this.prisma.supplier.create({
      data: {
        tenantId,
        name: input.name.trim(),
        contactName: input.contactName?.trim() || null,
        email: normalizedEmail,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
      },
    });
  }

  async listSuppliers(tenantId: string, input: ListSuppliersInput) {
    const where: Prisma.SupplierWhereInput = {
      tenantId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { email: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.supplier.findMany({
        where,
        orderBy: [{ name: 'asc' }],
        skip,
        take: input.pageSize,
      }),
      this.prisma.supplier.count({ where }),
    ]);

    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async getSupplier(tenantId: string, supplierId: string) {
    const supplier = await this.prisma.supplier.findFirst({
      where: { id: supplierId, tenantId },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }
    return supplier;
  }

  async updateSupplier(
    tenantId: string,
    supplierId: string,
    input: UpdateSupplierInput,
  ) {
    await this.getSupplier(tenantId, supplierId);

    const data: Prisma.SupplierUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.contactName !== undefined)
      data.contactName = input.contactName?.trim() || null;
    if (input.email !== undefined)
      data.email = input.email?.trim().toLowerCase() || null;
    if (input.phone !== undefined) data.phone = input.phone?.trim() || null;
    if (input.address !== undefined)
      data.address = input.address?.trim() || null;
    if (input.status !== undefined) data.status = input.status;

    return this.prisma.supplier.update({
      where: { id: supplierId },
      data,
    });
  }

  // --- Purchase Orders ---

  async createPurchaseOrder(
    tenantId: string,
    actor: AuthenticatedUser,
    input: CreatePurchaseOrderInput,
  ) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    const supplier = await this.prisma.supplier.findFirst({
      where: { id: input.supplierId, tenantId, status: 'ACTIVE' },
    });
    if (!supplier) {
      throw new NotFoundException('Supplier not found.');
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: input.items.map((i) => i.productId) },
        tenantId,
        isActive: true,
      },
    });

    if (products.length !== input.items.length) {
      throw new NotFoundException('One or more products not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const orderNumber = `PO-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const totalAmount = input.items.reduce((sum, item) => {
        return sum + parseFloat(item.unitCost) * parseFloat(item.quantityOrdered);
      }, 0);

      const po = await tx.purchaseOrder.create({
        data: {
          tenantId,
          storeId: input.storeId,
          supplierId: input.supplierId,
          orderNumber,
          status: 'DRAFT',
          totalAmount: new Prisma.Decimal(totalAmount),
          notes: input.notes?.trim() || null,
          createdByMembershipId: actor.membershipId,
        },
      });

      for (const item of input.items) {
        const unitCost = new Prisma.Decimal(item.unitCost);
        const quantity = new Prisma.Decimal(item.quantityOrdered);
        await tx.purchaseOrderItem.create({
          data: {
            tenantId,
            purchaseOrderId: po.id,
            productId: item.productId,
            quantityOrdered: quantity,
            unitCost,
            totalCost: unitCost.mul(quantity),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'purchases.purchase_order_created',
          resource: 'purchase_order',
          resourceId: po.id,
          metadata: {
            orderNumber,
            supplierId: input.supplierId,
            itemCount: input.items.length,
            totalAmount,
          },
        },
      });

      return tx.purchaseOrder.findUnique({
        where: { id: po.id },
        include: { items: { include: { product: { select: { id: true, sku: true, name: true, baseUnit: true } } } } },
      });
    });
  }

  async listPurchaseOrders(
    tenantId: string,
    storeId?: string,
    status?: string,
    page = 1,
    pageSize = 25,
    storeIds?: string[],
  ) {
    const where: Prisma.PurchaseOrderWhereInput = {
      tenantId,
      ...(storeId ? { storeId } : {}),
      ...(storeIds ? { storeId: { in: storeIds } } : {}),
      ...(status ? { status } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.purchaseOrder.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true } },
          store: { select: { id: true, name: true, code: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.purchaseOrder.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async getPurchaseOrder(tenantId: string, orderId: string) {
    const po = await this.prisma.purchaseOrder.findFirst({
      where: { id: orderId, tenantId },
      include: {
        supplier: { select: { id: true, name: true } },
        store: { select: { id: true, name: true, code: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, baseUnit: true } } } },
      },
    });
    if (!po) {
      throw new NotFoundException('Purchase order not found.');
    }
    return po;
  }

  async approvePurchaseOrder(
    tenantId: string,
    orderId: string,
    actor: AuthenticatedUser,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const po = await tx.purchaseOrder.findFirst({
        where: { id: orderId, tenantId, status: 'DRAFT' },
      });
      if (!po) {
        throw new NotFoundException('Draft purchase order not found.');
      }

      const updated = await tx.purchaseOrder.update({
        where: { id: orderId },
        data: {
          status: 'APPROVED',
          approvedByMembershipId: actor.membershipId,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'purchases.purchase_order_approved',
          resource: 'purchase_order',
          resourceId: orderId,
          metadata: { orderNumber: po.orderNumber },
        },
      });

      return updated;
    });
  }

  // --- Goods Receipts ---

  async receiveGoods(
    tenantId: string,
    actor: AuthenticatedUser,
    input: ReceiveGoodsInput,
  ) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    const products = await this.prisma.product.findMany({
      where: {
        id: { in: input.items.map((i) => i.productId) },
        tenantId,
        isActive: true,
      },
    });

    if (products.length !== input.items.length) {
      throw new NotFoundException('One or more products not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const receiptNumber = `GR-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      const gr = await tx.goodsReceipt.create({
        data: {
          tenantId,
          storeId: input.storeId,
          purchaseOrderId: input.purchaseOrderId || null,
          receiptNumber,
          status: 'COMPLETED',
          receivedByMembershipId: actor.membershipId,
        },
      });

      for (const item of input.items) {
        const unitCost = new Prisma.Decimal(item.unitCost);
        const quantity = new Prisma.Decimal(item.quantityReceived);
        await tx.goodsReceiptItem.create({
          data: {
            tenantId,
            goodsReceiptId: gr.id,
            productId: item.productId,
            quantityReceived: quantity,
            unitCost,
            totalCost: unitCost.mul(quantity),
          },
        });

        // Update inventory balance
        await tx.inventoryBalance.upsert({
          where: {
            tenantId_storeId_productId: {
              tenantId,
              storeId: input.storeId,
              productId: item.productId,
            },
          },
          create: {
            tenantId,
            storeId: input.storeId,
            productId: item.productId,
            quantityOnHand: quantity,
          },
          update: {
            quantityOnHand: { increment: quantity },
          },
        });

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            tenantId,
            storeId: input.storeId,
            productId: item.productId,
            quantityDelta: quantity,
            reason: 'goods_received',
            reference: receiptNumber,
            actorMembershipId: actor.membershipId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'purchases.goods_received',
          resource: 'goods_receipt',
          resourceId: gr.id,
          metadata: {
            receiptNumber,
            itemCount: input.items.length,
          },
        },
      });

      return tx.goodsReceipt.findUnique({
        where: { id: gr.id },
        include: {
          items: {
            include: { product: { select: { id: true, sku: true, name: true, baseUnit: true } } },
          },
        },
      });
    });
  }

  async listGoodsReceipts(
    tenantId: string,
    storeId?: string,
    page = 1,
    pageSize = 25,
    storeIds?: string[],
  ) {
    const where: Prisma.GoodsReceiptWhereInput = {
      tenantId,
      ...(storeId ? { storeId } : {}),
      ...(storeIds ? { storeId: { in: storeIds } } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.goodsReceipt.findMany({
        where,
        include: {
          store: { select: { id: true, name: true, code: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.goodsReceipt.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }
}
