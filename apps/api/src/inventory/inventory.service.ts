import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export interface AdjustStockInput {
  productId: string;
  quantityDelta: string;
  reason: string;
}

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listStoreInventory(tenantId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store) {
      throw new NotFoundException('Store not found.');
    }

    return this.prisma.inventoryBalance.findMany({
      where: {
        tenantId,
        storeId,
        product: { isActive: true },
      },
      include: {
        product: {
          select: {
            id: true,
            sku: true,
            name: true,
            baseUnit: true,
          },
        },
      },
      orderBy: [{ product: { name: 'asc' } }, { productId: 'asc' }],
    });
  }

  async adjustStock(
    tenantId: string,
    storeId: string,
    actor: AuthenticatedUser,
    input: AdjustStockInput,
    idempotencyKey: string,
  ) {
    const normalizedKey = idempotencyKey.trim();
    const delta = new Prisma.Decimal(input.quantityDelta);
    if (delta.isZero()) {
      throw new BadRequestException('Stock adjustment quantity must not be zero.');
    }
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const existingMovement = await transaction.stockMovement.findUnique({
          where: {
            tenantId_idempotencyKey: { tenantId, idempotencyKey: normalizedKey },
          },
        });
        if (existingMovement) {
          this.assertSameRequest(existingMovement, storeId, input);
          const balance = await transaction.inventoryBalance.findUniqueOrThrow({
            where: {
              tenantId_storeId_productId: {
                tenantId,
                storeId,
                productId: input.productId,
              },
            },
            select: { quantityOnHand: true },
          });
          return {
            movement: existingMovement,
            balance,
            replayed: true,
          };
        }

        const [store, product] = await Promise.all([
          transaction.store.findFirst({
            where: { id: storeId, tenantId, status: 'ACTIVE' },
            select: { id: true },
          }),
          transaction.product.findFirst({
            where: { id: input.productId, tenantId, isActive: true },
            select: { id: true },
          }),
        ]);
        if (!store) {
          throw new NotFoundException('Store not found.');
        }
        if (!product) {
          throw new NotFoundException('Product not found.');
        }

        if (delta.isPositive()) {
          await transaction.inventoryBalance.upsert({
            where: {
              tenantId_storeId_productId: {
                tenantId,
                storeId,
                productId: product.id,
              },
            },
            create: {
              tenantId,
              storeId,
              productId: product.id,
              quantityOnHand: delta,
            },
            update: {
              quantityOnHand: { increment: delta },
            },
          });
        } else {
          const result = await transaction.inventoryBalance.updateMany({
            where: {
              tenantId,
              storeId,
              productId: product.id,
              quantityOnHand: { gte: delta.abs() },
            },
            data: {
              quantityOnHand: { decrement: delta.abs() },
            },
          });
          if (result.count !== 1) {
            throw new ConflictException('Stock adjustment would make inventory negative.');
          }
        }

        const movement = await transaction.stockMovement.create({
          data: {
            tenantId,
            storeId,
            productId: product.id,
            quantityDelta: delta,
            reason: input.reason.trim(),
            idempotencyKey: normalizedKey,
            actorMembershipId: actor.membershipId,
          },
        });
        const balance = await transaction.inventoryBalance.findUniqueOrThrow({
          where: {
            tenantId_storeId_productId: {
              tenantId,
              storeId,
              productId: product.id,
            },
          },
          select: { quantityOnHand: true },
        });

        await transaction.auditLog.create({
          data: {
            tenantId,
            actorMembershipId: actor.membershipId,
            actorUserId: actor.id,
            action: 'inventory.stock_adjusted',
            resource: 'stock_movement',
            resourceId: movement.id,
            metadata: {
              storeId,
              productId: product.id,
              quantityDelta: delta.toString(),
              reason: input.reason.trim(),
              resultingQuantity: balance.quantityOnHand.toString(),
              idempotencyKey: normalizedKey,
            },
          },
        });

        return { movement, balance, replayed: false };
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existingMovement = await this.prisma.stockMovement.findUnique({
          where: {
            tenantId_idempotencyKey: { tenantId, idempotencyKey: normalizedKey },
          },
        });
        if (!existingMovement) {
          throw error;
        }
        this.assertSameRequest(existingMovement, storeId, input);
        const balance = await this.prisma.inventoryBalance.findUniqueOrThrow({
          where: {
            tenantId_storeId_productId: {
              tenantId,
              storeId,
              productId: input.productId,
            },
          },
          select: { quantityOnHand: true },
        });
        return { movement: existingMovement, balance, replayed: true };
      }
      throw error;
    }
  }

  private assertSameRequest(
    movement: {
      storeId: string;
      productId: string;
      quantityDelta: Prisma.Decimal;
      reason: string;
    },
    storeId: string,
    input: AdjustStockInput,
  ): void {
    if (
      movement.storeId !== storeId ||
      movement.productId !== input.productId ||
      !movement.quantityDelta.equals(new Prisma.Decimal(input.quantityDelta)) ||
      movement.reason !== input.reason.trim()
    ) {
      throw new ConflictException('Idempotency key was already used for a different stock adjustment.');
    }
  }
}
