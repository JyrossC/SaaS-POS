import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export interface CreateRefundInput {
  saleId: string;
  reason: string;
  items: Array<{
    saleItemId: string;
    quantity: string;
  }>;
}

@Injectable()
export class ReturnsService {
  constructor(private readonly prisma: PrismaService) {}

  async createRefund(
    tenantId: string,
    actor: AuthenticatedUser,
    input: CreateRefundInput,
  ) {
    const reason = input.reason.trim();
    if (!reason) {
      throw new BadRequestException('A refund reason is required.');
    }
    if (input.items.length === 0) {
      throw new BadRequestException('At least one sale item is required for a refund.');
    }

    for (let attempt = 0; attempt < 3; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const sale = await tx.sale.findFirst({
            where: {
              id: input.saleId,
              tenantId,
              status: 'COMPLETED',
              ...(!actor.allStoreAccess ? { storeId: { in: actor.storeIds } } : {}),
            },
            include: { items: true },
          });
          if (!sale) {
            throw new NotFoundException('Completed sale not found.');
          }

          const priorRefundRows = await tx.refundItem.groupBy({
            by: ['saleItemId'],
            where: {
              tenantId,
              saleItemId: { in: sale.items.map((item) => item.id) },
            },
            _sum: { quantity: true },
          });
          const priorRefunded = new Map(
            priorRefundRows.map((row) => [
              row.saleItemId,
              row._sum.quantity ?? new Prisma.Decimal(0),
            ]),
          );

          const requested = new Map<string, Prisma.Decimal>();
          for (const item of input.items) {
            const saleItem = sale.items.find((candidate) => candidate.id === item.saleItemId);
            if (!saleItem) {
              throw new NotFoundException(`Sale item ${item.saleItemId} not found.`);
            }

            let quantity: Prisma.Decimal;
            try {
              quantity = new Prisma.Decimal(item.quantity);
            } catch {
              throw new BadRequestException(`Invalid refund quantity for item ${item.saleItemId}.`);
            }
            if (quantity.lte(0)) {
              throw new BadRequestException(`Invalid refund quantity for item ${item.saleItemId}.`);
            }
            requested.set(
              item.saleItemId,
              (requested.get(item.saleItemId) ?? new Prisma.Decimal(0)).add(quantity),
            );
          }

          let totalAmount = new Prisma.Decimal(0);
          const refundItemsData: Array<{
            saleItemId: string;
            productId: string;
            quantity: Prisma.Decimal;
            amount: Prisma.Decimal;
          }> = [];

          for (const [saleItemId, quantity] of requested) {
            const saleItem = sale.items.find((candidate) => candidate.id === saleItemId)!;
            const alreadyRefunded = priorRefunded.get(saleItemId) ?? new Prisma.Decimal(0);
            if (alreadyRefunded.add(quantity).gt(saleItem.quantity)) {
              throw new BadRequestException(
                `Refund quantity exceeds the remaining refundable quantity for item ${saleItemId}.`,
              );
            }

            const amount = saleItem.unitPrice.mul(quantity);
            totalAmount = totalAmount.add(amount);
            refundItemsData.push({
              saleItemId,
              productId: saleItem.productId,
              quantity,
              amount,
            });
          }

          const refundNumber = `REF-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
          const refund = await tx.refund.create({
            data: {
              tenantId,
              saleId: input.saleId,
              refundNumber,
              reason,
              totalAmount,
              status: 'COMPLETED',
              processedByMembershipId: actor.membershipId,
            },
          });

          const saleItemById = new Map(sale.items.map((si) => [si.id, si]));

          for (const itemData of refundItemsData) {
            await tx.refundItem.create({
              data: {
                tenantId,
                refundId: refund.id,
                saleItemId: itemData.saleItemId,
                productId: itemData.productId,
                quantity: itemData.quantity,
                amount: itemData.amount,
              },
            });

            // Track refunded quantity on sale item to prevent over-refunding
            await tx.saleItem.update({
              where: { id: itemData.saleItemId },
              data: { quantityRefunded: { increment: itemData.quantity } },
            });

            // Restore batch inventory for pharmacy products that tracked batch
            const saleItem = saleItemById.get(itemData.saleItemId);
            if (saleItem?.batchId) {
              await tx.batchInventory.updateMany({
                where: {
                  tenantId,
                  storeId: sale.storeId,
                  batchId: saleItem.batchId,
                },
                data: {
                  quantityOnHand: { increment: itemData.quantity },
                },
              });
            }

            await tx.inventoryBalance.upsert({
              where: {
                tenantId_storeId_productId: {
                  tenantId,
                  storeId: sale.storeId,
                  productId: itemData.productId,
                },
              },
              create: {
                tenantId,
                storeId: sale.storeId,
                productId: itemData.productId,
                quantityOnHand: itemData.quantity,
              },
              update: { quantityOnHand: { increment: itemData.quantity } },
            });

            await tx.stockMovement.create({
              data: {
                tenantId,
                storeId: sale.storeId,
                productId: itemData.productId,
                quantityDelta: itemData.quantity,
                reason: 'refund',
                reference: refundNumber,
                actorMembershipId: actor.membershipId,
              },
            });
          }

          const allItemsRefunded = sale.items.every((saleItem) => {
            const alreadyRefunded = priorRefunded.get(saleItem.id) ?? new Prisma.Decimal(0);
            const thisRefund = requested.get(saleItem.id) ?? new Prisma.Decimal(0);
            return alreadyRefunded.add(thisRefund).gte(saleItem.quantity);
          });

          if (allItemsRefunded) {
            await tx.sale.update({
              where: { id: input.saleId },
              data: { status: 'REFUNDED' },
            });
          }

          await tx.auditLog.create({
            data: {
              tenantId,
              actorMembershipId: actor.membershipId,
              actorUserId: actor.id,
              action: 'sales.refunded',
              resource: 'refund',
              resourceId: refund.id,
              metadata: {
                refundNumber,
                saleId: input.saleId,
                totalAmount: totalAmount.toString(),
                itemCount: refundItemsData.length,
              },
            },
          });

          return tx.refund.findUnique({
            where: { id: refund.id },
            include: {
              items: { include: { product: { select: { id: true, sku: true, name: true } } } },
            },
          });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        const isSerializationConflict =
          error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!isSerializationConflict) throw error;
        if (attempt === 2) {
          throw new ConflictException('Refund conflicted with another update. Please retry.');
        }
      }
    }

    throw new ConflictException('Refund could not be completed. Please retry.');
  }

  async listRefunds(
    tenantId: string,
    saleId?: string,
    page = 1,
    pageSize = 25,
    storeIds?: string[],
  ) {
    const where: Prisma.RefundWhereInput = {
      tenantId,
      ...(saleId ? { saleId } : {}),
      ...(storeIds ? { sale: { storeId: { in: storeIds } } } : {}),
    };
    const skip = (page - 1) * pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.refund.findMany({
        where,
        include: {
          sale: { select: { id: true, saleNumber: true } },
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return { items, page, pageSize, total };
  }

  async getRefund(tenantId: string, refundId: string, storeIds?: string[]) {
    const refund = await this.prisma.refund.findFirst({
      where: {
        id: refundId,
        tenantId,
        ...(storeIds ? { sale: { storeId: { in: storeIds } } } : {}),
      },
      include: {
        sale: { select: { id: true, saleNumber: true, storeId: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
      },
    });
    if (!refund) {
      throw new NotFoundException('Refund not found.');
    }
    return refund;
  }
}
