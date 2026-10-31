import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash } from 'crypto';
import { Prisma } from '@prisma/client';
import { SaleStatus } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

import { PharmacyService } from '../pharmacy/pharmacy.service';
import { CampaignService, CampaignEligibilityCheck } from '../campaigns/campaign.service';

export interface SaleItemInput {
  productId: string;
  quantity: string;
}

export interface PaymentInput {
  paymentMethod: string;
  amount: string;
  reference?: string | null;
}

export interface CreateSaleInput {
  storeId: string;
  items: SaleItemInput[];
  payments: PaymentInput[];
  notes?: string | null;
  idempotencyKey: string;
  campaignId?: string | null;
  promoCode?: string | null;
}

@Injectable()
export class SalesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pharmacyService: PharmacyService,
    private readonly campaignService: CampaignService,
  ) {}

  async createSale(
    tenantId: string,
    actor: AuthenticatedUser,
    input: CreateSaleInput,
  ) {
    const idempotencyKey = input.idempotencyKey.trim();
    if (!idempotencyKey) {
      throw new BadRequestException('An idempotency key is required.');
    }

    return await this.prisma.$transaction(async (tx) => {
      try {
        return await this.createSaleTransaction(tx, tenantId, actor, input, idempotencyKey);
      } catch (error) {
        // Handle idempotency key conflict - another request created the same sale
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const existingSale = await this.prisma.sale.findFirst({
            where: { tenantId, idempotencyKey },
            include: {
              items: { include: { product: { select: { id: true, sku: true, name: true, baseUnit: true } } } },
              payments: true,
            },
          });
          if (existingSale) {
            return existingSale;
          }
        }
        throw error;
      }
    });
  }

  async createSaleTransaction(
    tx: Prisma.TransactionClient,
    tenantId: string,
    actor: AuthenticatedUser,
    input: CreateSaleInput,
    idempotencyKey: string,
  ) {
    // Check idempotency - if a sale with this key already exists, return it
    const existingSale = await tx.sale.findFirst({
      where: { tenantId, idempotencyKey },
      include: {
        items: { include: { product: { select: { id: true, sku: true, name: true, baseUnit: true } } } },
        payments: true,
      },
    });
    if (existingSale) {
      return existingSale;
    }

    const store = await tx.store.findFirst({
      where: { id: input.storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store || (!actor.allStoreAccess && !actor.storeIds.includes(input.storeId))) {
      throw new NotFoundException('Store not found.');
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true },
      include: { drugDetails: true },
    });

    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found.');
    }

    const productMap = new Map(products.map((p) => [p.id, p]));
    const pharmacyProductIds = new Set(
      products.filter((p) => p.drugDetails && p.drugDetails.length > 0).map((p) => p.id),
    );

    // Validate quantities
    for (const item of input.items) {
      const qty = new Prisma.Decimal(item.quantity);
      if (qty.lte(0)) {
        throw new BadRequestException('Sale item quantity must be positive.');
      }
    }

    // Validate payments
    let totalPayment = new Prisma.Decimal(0);
    for (const payment of input.payments) {
      totalPayment = totalPayment.add(new Prisma.Decimal(payment.amount));
    }

    // Generate sale number
    const saleNumber = `SALE-${createHash('sha256')
      .update(`${tenantId}:${idempotencyKey}`)
      .digest('hex')
      .slice(0, 24)
      .toUpperCase()}`;

    // Calculate totals server-side
    let subtotal = new Prisma.Decimal(0);
    const saleItemsData: Array<{
      productId: string;
      quantity: Prisma.Decimal;
      unitPrice: Prisma.Decimal;
      totalPrice: Prisma.Decimal;
    }> = [];

    for (const item of input.items) {
      const product = productMap.get(item.productId)!;
      const quantity = new Prisma.Decimal(item.quantity);
      const unitPrice = product.sellingPrice;
      const totalPrice = unitPrice.mul(quantity);
      subtotal = subtotal.add(totalPrice);

      saleItemsData.push({
        productId: item.productId,
        quantity,
        unitPrice,
        totalPrice,
      });
    }

    const totalAmount = subtotal;
    let campaignDiscount = new Prisma.Decimal(0);
    let appliedCampaignId: string | null = null;

    // Campaign eligibility and discount application
    if (input.campaignId || input.promoCode) {
      const productIds = input.items.map((i) => i.productId);
      const cartTotal = subtotal;
      const cartQuantity = input.items.reduce((sum, item) => sum + Number(item.quantity), 0);
      const paymentMethod = input.payments[0]?.paymentMethod || null;

      const eligibility = await this.campaignService.checkEligibility(
        tenantId,
        actor.membershipId,
        input.storeId,
        cartTotal,
        cartQuantity,
        paymentMethod,
        input.promoCode || null,
        productIds,
      );

      // Find an eligible campaign
      let eligibleCampaign: CampaignEligibilityCheck | undefined;
      for (const e of eligibility) {
        if (e.eligible) {
          eligibleCampaign = e;
          break;
        }
      }
      if (!eligibleCampaign) {
        throw new BadRequestException('No eligible campaign found for this cart.');
      }

      campaignDiscount = eligibleCampaign.discountAmount;
      appliedCampaignId = eligibleCampaign.campaign.id;
    }

    // Validate total payment matches (subtotal - discount)
    const finalTotal = subtotal.sub(campaignDiscount);
    if (!totalPayment.equals(finalTotal)) {
      throw new BadRequestException(
        `Payment total (${totalPayment}) does not match sale total (${finalTotal}).`,
      );
    }

    // Create sale with idempotencyKey and campaign discount
    const sale = await tx.sale.create({
      data: {
        tenantId,
        storeId: input.storeId,
        cashierMembershipId: actor.membershipId,
        saleNumber,
        idempotencyKey,
        status: 'COMPLETED',
        subtotal,
        taxAmount: new Prisma.Decimal(0),
        discountAmount: campaignDiscount,
        totalAmount: finalTotal,
        notes: input.notes?.trim() || null,
      },
    });

    // Record campaign usage
    if (appliedCampaignId) {
      await tx.campaignUsage.create({
        data: {
          campaignId: appliedCampaignId,
          tenantId,
          customerId: actor.membershipId,
          storeId: input.storeId,
          saleId: sale.id,
          discountAmount: campaignDiscount,
        },
      });
    }

    // Create sale items and update inventory with conditional updates
    for (const itemData of saleItemsData) {
      const isPharmacy = pharmacyProductIds.has(itemData.productId);
      let allocatedBatchId: string | null = null;

      if (isPharmacy) {
        // FEFO allocation: verifies non-expired, non-quarantined batch stock exists
        const allocation = await this.pharmacyService.allocateFEFO(
          tenantId,
          input.storeId,
          itemData.productId,
          itemData.quantity,
          tx,
        );

        // Decrement batch inventory for each FEFO allocation
        for (const alloc of allocation) {
          const batchDecrement = await tx.batchInventory.updateMany({
            where: {
              tenantId,
              storeId: input.storeId,
              batchId: alloc.batchId,
              quantityOnHand: { gte: alloc.quantity },
            },
            data: {
              quantityOnHand: { decrement: alloc.quantity },
            },
          });
          if (batchDecrement.count !== 1) {
            throw new ConflictException(
              `Batch stock changed during sale for batch ${alloc.batchId}. Refresh and retry.`,
            );
          }
        }

        allocatedBatchId = allocation[0].batchId;
      }

      await tx.saleItem.create({
        data: {
          tenantId,
          saleId: sale.id,
          productId: itemData.productId,
          batchId: allocatedBatchId,
          quantity: itemData.quantity,
          unitPrice: itemData.unitPrice,
          totalPrice: itemData.totalPrice,
          taxAmount: new Prisma.Decimal(0),
          discountAmount: new Prisma.Decimal(0),
          quantityRefunded: new Prisma.Decimal(0),
        },
      });

      // Atomic aggregate inventory decrement - prevents overselling under concurrency
      const decrement = await tx.inventoryBalance.updateMany({
        where: {
          tenantId,
          storeId: input.storeId,
          productId: itemData.productId,
          quantityOnHand: { gte: itemData.quantity },
        },
        data: {
          quantityOnHand: { decrement: itemData.quantity },
        },
      });
      if (decrement.count !== 1) {
        throw new ConflictException(
          `Insufficient stock for product ${itemData.productId}.`,
        );
      }

      // Record stock movement
      await tx.stockMovement.create({
        data: {
          tenantId,
          storeId: input.storeId,
          productId: itemData.productId,
          quantityDelta: itemData.quantity.neg(),
          reason: isPharmacy ? 'pharmacy_sale' : 'sale',
          reference: saleNumber,
          actorMembershipId: actor.membershipId,
          idempotencyKey,
        },
      });
    }

    // Create payment records
    for (const payment of input.payments) {
      await tx.salePayment.create({
        data: {
          tenantId,
          saleId: sale.id,
          paymentMethod: payment.paymentMethod,
          amount: new Prisma.Decimal(payment.amount),
          reference: payment.reference?.trim() || null,
        },
      });
    }

    // Create audit log
    await tx.auditLog.create({
      data: {
        tenantId,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.id,
        action: 'sales.created',
        resource: 'sale',
        resourceId: sale.id,
        metadata: {
          saleNumber,
          storeId: input.storeId,
          itemCount: input.items.length,
          totalAmount: totalAmount.toString(),
        },
      },
    });

    return tx.sale.findUnique({
      where: { id: sale.id },
      include: {
        items: {
          include: { product: { select: { id: true, sku: true, name: true, baseUnit: true } } },
        },
        payments: true,
      },
    });
  }

  async listSales(
    tenantId: string,
    storeId?: string,
    status?: string,
    page = 1,
    pageSize = 25,
    storeIds?: string[],
  ) {
    const where: Prisma.SaleWhereInput = {
      tenantId,
      ...(storeId ? { storeId } : storeIds ? { storeId: { in: storeIds } } : {}),
      ...(status ? { status: status as SaleStatus } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.sale.findMany({
        where,
        include: {
          store: { select: { id: true, name: true, code: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true, baseUnit: true } } } },
          payments: true,
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.sale.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async getSale(tenantId: string, saleId: string, storeIds?: string[]) {
    const sale = await this.prisma.sale.findFirst({
      where: {
        id: saleId,
        tenantId,
        ...(storeIds ? { storeId: { in: storeIds } } : {}),
      },
      include: {
        store: { select: { id: true, name: true, code: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true, baseUnit: true } } } },
        payments: true,
      },
    });
    if (!sale) {
      throw new NotFoundException('Sale not found.');
    }
    return sale;
  }

  async voidSale(
    tenantId: string,
    saleId: string,
    actor: AuthenticatedUser,
    reason: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const sale = await tx.sale.findFirst({
        where: {
          id: saleId,
          tenantId,
          status: 'COMPLETED',
          ...(!actor.allStoreAccess ? { storeId: { in: actor.storeIds } } : {}),
        },
        include: { items: true },
      });
      if (!sale) {
        throw new NotFoundException('Completed sale not found.');
      }

      const claim = await tx.sale.updateMany({
        where: {
          id: saleId,
          tenantId,
          status: 'COMPLETED',
          ...(!actor.allStoreAccess ? { storeId: { in: actor.storeIds } } : {}),
        },
        data: { status: 'VOIDED' },
      });
      if (claim.count !== 1) {
        throw new ConflictException('Sale has already been changed. Refresh and retry.');
      }

      // Restore inventory
      for (const item of sale.items) {
        const balance = await tx.inventoryBalance.findFirst({
          where: {
            tenantId,
            storeId: sale.storeId,
            productId: item.productId,
          },
        });
        if (balance) {
          await tx.inventoryBalance.update({
            where: { id: balance.id },
            data: { quantityOnHand: { increment: item.quantity } },
          });
        }

        await tx.stockMovement.create({
          data: {
            tenantId,
            storeId: sale.storeId,
            productId: item.productId,
            quantityDelta: item.quantity,
            reason: 'sale_void',
            reference: sale.saleNumber,
            actorMembershipId: actor.membershipId,
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'sales.voided',
          resource: 'sale',
          resourceId: saleId,
          metadata: { saleNumber: sale.saleNumber, reason },
        },
      });

      return tx.sale.findUnique({ where: { id: saleId } });
    });
  }
}
