import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export interface CreateDrugDetailInput {
  productId: string;
  genericName?: string | null;
  brandName?: string | null;
  strength?: string | null;
  dosageForm?: string | null;
  manufacturer?: string | null;
  regulatoryCategory?: string | null;
  prescriptionRequired?: boolean;
}

export interface CreateBatchInput {
  storeId: string;
  productId: string;
  batchNumber: string;
  supplierId?: string | null;
  manufacturedAt?: string | null;
  expiresAt: string;
  quantityReceived: string;
  costPerUnit?: string | null;
}

export interface DispenseInput {
  storeId: string;
  prescriptionId?: string | null;
  items: Array<{
    productId: string;
    quantity: string;
  }>;
  notes?: string | null;
}

export interface QuarantineInput {
  storeId: string;
  batchId: string;
  quantity: string;
  reason: string;
}

export interface CreatePrescriptionInput {
  storeId: string;
  patientName?: string | null;
  patientId?: string | null;
  prescriberName?: string | null;
  prescriberLicense?: string | null;
  items: Array<{
    productId: string;
    quantityPrescribed: string;
  }>;
}

export interface PrescriptionQuery {
  storeId?: string;
  status?: string;
  patientName?: string;
}

@Injectable()
export class PharmacyService {
  constructor(private readonly prisma: PrismaService) {}

  // --- Drug Details ---

  async createDrugDetail(tenantId: string, input: CreateDrugDetailInput) {
    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId, isActive: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    return this.prisma.drugDetail.create({
      data: {
        tenantId,
        productId: input.productId,
        genericName: input.genericName?.trim() || null,
        brandName: input.brandName?.trim() || null,
        strength: input.strength?.trim() || null,
        dosageForm: input.dosageForm?.trim() || null,
        manufacturer: input.manufacturer?.trim() || null,
        regulatoryCategory: input.regulatoryCategory?.trim() || null,
        prescriptionRequired: input.prescriptionRequired ?? false,
      },
    });
  }

  async getDrugDetail(tenantId: string, productId: string) {
    return this.prisma.drugDetail.findFirst({
      where: { tenantId, productId },
    });
  }

  // --- Batch Management ---

  async createBatch(tenantId: string, actor: AuthenticatedUser, input: CreateBatchInput) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store || (!actor.allStoreAccess && !actor.storeIds.includes(input.storeId))) {
      throw new NotFoundException('Store not found.');
    }

    const product = await this.prisma.product.findFirst({
      where: { id: input.productId, tenantId, isActive: true },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }

    const expiresAt = new Date(input.expiresAt);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException('Batch expiry date must be in the future.');
    }
    const quantity = new Prisma.Decimal(input.quantityReceived);
    if (quantity.lte(0)) {
      throw new BadRequestException('Received quantity must be positive.');
    }
    const costPerUnit = input.costPerUnit ? new Prisma.Decimal(input.costPerUnit) : null;
    if (costPerUnit?.lt(0)) {
      throw new BadRequestException('Unit cost cannot be negative.');
    }

    if (input.supplierId) {
      const supplier = await this.prisma.supplier.findFirst({
        where: { id: input.supplierId, tenantId, status: 'ACTIVE' },
      });
      if (!supplier) throw new NotFoundException('Supplier not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const batch = await tx.productBatch.create({
        data: {
          tenantId,
          productId: input.productId,
          batchNumber: input.batchNumber.trim(),
          supplierId: input.supplierId || null,
          manufacturedAt: input.manufacturedAt ? new Date(input.manufacturedAt) : null,
          expiresAt,
          quantityReceived: quantity,
          costPerUnit,
        },
      });

      await tx.batchInventory.create({
        data: { tenantId, storeId: input.storeId, batchId: batch.id, quantityOnHand: quantity },
      });
      await tx.inventoryBalance.upsert({
        where: {
          tenantId_storeId_productId: {
            tenantId,
            storeId: input.storeId,
            productId: input.productId,
          },
        },
        create: {
          tenantId,
          storeId: input.storeId,
          productId: input.productId,
          quantityOnHand: quantity,
        },
        update: { quantityOnHand: { increment: quantity } },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          storeId: input.storeId,
          productId: input.productId,
          quantityDelta: quantity,
          reason: 'pharmacy_batch_received',
          reference: batch.batchNumber,
          actorMembershipId: actor.membershipId,
        },
      });
      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'pharmacy.batch_received',
          resource: 'product_batch',
          resourceId: batch.id,
          metadata: { storeId: input.storeId, batchNumber: batch.batchNumber, quantity: quantity.toString() },
        },
      });
      return batch;
    });
  }

  async listBatches(tenantId: string, productId?: string, storeIds?: string[]) {
    return this.prisma.productBatch.findMany({
      where: {
        tenantId,
        ...(productId ? { productId } : {}),
        ...(storeIds ? { inventory: { some: { tenantId, storeId: { in: storeIds } } } } : {}),
      },
      include: {
        product: { select: { id: true, sku: true, name: true, baseUnit: true } },
      },
      orderBy: [{ expiresAt: 'asc' }],
    });
  }

  async getExpiringBatches(tenantId: string, daysAhead = 30, storeIds?: string[]) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + daysAhead);

    return this.prisma.productBatch.findMany({
      where: {
        tenantId,
        expiresAt: { lte: cutoff, gt: new Date() },
        ...(storeIds ? { inventory: { some: { tenantId, storeId: { in: storeIds } } } } : {}),
      },
      include: {
        product: { select: { id: true, sku: true, name: true, baseUnit: true } },
        inventory: storeIds
          ? { where: { tenantId, storeId: { in: storeIds } } }
          : true,
      },
      orderBy: [{ expiresAt: 'asc' }],
    });
  }

  // --- FEFO Allocation ---

  async allocateFEFO(
    tenantId: string,
    storeId: string,
    productId: string,
    quantityNeeded: Prisma.Decimal,
    db: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<Array<{ batchId: string; batchNumber: string; quantity: Prisma.Decimal }>> {
    const now = new Date();

    // Get batches sorted by expiry (FEFO)
    const batches = await db.productBatch.findMany({
      where: {
        tenantId,
        productId,
        expiresAt: { gt: now },
        stockQuarantines: {
          none: {
            storeId,
            releasedAt: null,
          },
        },
      },
      include: {
        inventory: {
          where: { storeId, tenantId },
        },
      },
      orderBy: [{ expiresAt: 'asc' }],
    });

    const allocation: Array<{ batchId: string; batchNumber: string; quantity: Prisma.Decimal }> = [];
    let remaining = quantityNeeded;

    for (const batch of batches) {
      if (remaining.lte(0)) break;

      const available = batch.inventory[0]?.quantityOnHand ?? new Prisma.Decimal(0);
      if (available.lte(0)) continue;

      const allocate = available.lt(remaining) ? available : remaining;
      allocation.push({
        batchId: batch.id,
        batchNumber: batch.batchNumber,
        quantity: allocate,
      });
      remaining = remaining.sub(allocate);
    }

    if (remaining.gt(0)) {
      throw new BadRequestException(
        `Insufficient non-expired stock. Short by ${remaining} units.`,
      );
    }

    return allocation;
  }

  // --- Dispensing ---

  async dispense(
    tenantId: string,
    actor: AuthenticatedUser,
    input: DispenseInput,
  ) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store || (!actor.allStoreAccess && !actor.storeIds.includes(input.storeId))) {
      throw new NotFoundException('Store not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      if (!Array.isArray(input.items) || input.items.length === 0) {
        throw new BadRequestException('At least one product is required for dispensing.');
      }
      let prescription: {
        id: string;
        status: string;
        items: Array<{
          id: string;
          productId: string;
          quantityPrescribed: Prisma.Decimal;
          quantityDispensed: Prisma.Decimal;
        }>;
      } | null = null;
      if (input.prescriptionId) {
        const found = await tx.prescription.findFirst({
          where: { id: input.prescriptionId, tenantId, storeId: input.storeId },
          include: {
            items: {
              select: {
                id: true,
                productId: true,
                quantityPrescribed: true,
                quantityDispensed: true,
              },
            },
          },
        });
        if (!found) throw new NotFoundException('Prescription not found for this store.');
        if (found.status === 'COMPLETED') {
          throw new BadRequestException('Prescription has already been fully dispensed.');
        }
        if (found.status === 'CANCELLED') {
          throw new BadRequestException('Prescription has been cancelled and cannot be dispensed.');
        }
        prescription = {
          id: found.id,
          status: found.status,
          items: found.items.map((pi) => ({
            id: pi.id,
            productId: pi.productId,
            quantityPrescribed: pi.quantityPrescribed,
            quantityDispensed: pi.quantityDispensed,
          })),
        };
      }

      // Fetch products with drug details to check prescription requirements
      const productIds = input.items.map((i) => i.productId);
      const products = await tx.product.findMany({
        where: { id: { in: productIds }, tenantId, isActive: true },
        include: { drugDetails: true },
      });
      if (products.length !== productIds.length) {
        throw new NotFoundException('One or more products not found.');
      }
      const productMap = new Map(products.map((p) => [p.id, p]));

      // If any item is prescription-required, a prescription must be provided
      const hasPrescriptionRequired = products.some(
        (p) => p.drugDetails?.some((d) => d.prescriptionRequired === true),
      );
      if (hasPrescriptionRequired && !input.prescriptionId) {
        throw new BadRequestException(
          'A prescription is required for one or more prescribed products.',
        );
      }

      const dispensingRecord = await tx.dispensingRecord.create({
        data: {
          tenantId,
          storeId: input.storeId,
          prescriptionId: input.prescriptionId || null,
          dispensedByMembershipId: actor.membershipId,
          notes: input.notes?.trim() || null,
        },
      });

      const prescriptionItemMap = prescription
        ? new Map(prescription.items.map((pi) => [pi.productId, pi]))
        : new Map<string, { id: string; quantityPrescribed: Prisma.Decimal; quantityDispensed: Prisma.Decimal }>();

      for (const item of input.items) {
        const quantity = new Prisma.Decimal(item.quantity);
        if (quantity.lte(0)) {
          throw new BadRequestException('Dispensing quantity must be positive.');
        }

        const product = productMap.get(item.productId)!;
        const isPrescriptionRequired = product.drugDetails?.some((d) => d.prescriptionRequired === true) ?? false;

        if (isPrescriptionRequired && !input.prescriptionId) {
          throw new BadRequestException(
            `Product ${item.productId} requires a valid prescription for dispensing.`,
          );
        }

        if (input.prescriptionId) {
          const rxItem = prescriptionItemMap.get(item.productId);
          if (!rxItem) {
            throw new NotFoundException(
              `Product ${item.productId} is not on the prescribed prescription.`,
            );
          }
          const remaining = rxItem.quantityPrescribed.sub(rxItem.quantityDispensed);
          if (quantity.gt(remaining)) {
            throw new BadRequestException(
              `Dispensing quantity ${quantity} exceeds remaining prescribed quantity ${remaining} for product ${item.productId}.`,
            );
          }
        }

        const allocation = await this.allocateFEFO(
          tenantId,
          input.storeId,
          item.productId,
          quantity,
          tx,
        );

        for (const alloc of allocation) {
          await tx.dispensingItem.create({
            data: {
              tenantId,
              dispensingRecordId: dispensingRecord.id,
              productId: item.productId,
              batchId: alloc.batchId,
              quantityDispensed: alloc.quantity,
            },
          });

          // Decrement batch inventory
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
            throw new ConflictException('Batch stock changed during dispensing. Refresh and retry.');
          }
        }

        const inventoryDecrement = await tx.inventoryBalance.updateMany({
          where: {
            tenantId,
            storeId: input.storeId,
            productId: item.productId,
            quantityOnHand: { gte: quantity },
          },
          data: { quantityOnHand: { decrement: quantity } },
        });
        if (inventoryDecrement.count !== 1) {
          throw new ConflictException('Store inventory changed during dispensing. Refresh and retry.');
        }

        // Update prescription item dispensed quantity
        if (input.prescriptionId) {
          const rxItem = prescriptionItemMap.get(item.productId)!;
          await tx.prescriptionItem.update({
            where: { id: rxItem.id },
            data: { quantityDispensed: { increment: quantity } },
          });
        }

        // Record stock movement
        await tx.stockMovement.create({
          data: {
            tenantId,
            storeId: input.storeId,
            productId: item.productId,
            quantityDelta: quantity.neg(),
            reason: 'dispensing',
            reference: dispensingRecord.id,
            actorMembershipId: actor.membershipId,
          },
        });
      }

      // If prescription provided, mark as completed when all items fully dispensed
      if (input.prescriptionId && prescription) {
        const allFullyDispensed = prescription.items.every((pi) => {
          const updatedDispensed = pi.quantityDispensed.add(
            input.items
              .filter((i) => i.productId === pi.productId)
              .reduce((sum, i) => sum.add(new Prisma.Decimal(i.quantity)), new Prisma.Decimal(0)),
          );
          return updatedDispensed.gte(pi.quantityPrescribed);
        });
        if (allFullyDispensed) {
          await tx.prescription.update({
            where: { id: prescription.id },
            data: { status: 'COMPLETED' },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'pharmacy.dispensed',
          resource: 'dispensing_record',
          resourceId: dispensingRecord.id,
          metadata: {
            storeId: input.storeId,
            itemCount: input.items.length,
          },
        },
      });

      return tx.dispensingRecord.findUnique({
        where: { id: dispensingRecord.id },
        include: { items: { include: { product: { select: { id: true, sku: true, name: true } }, batch: { select: { id: true, batchNumber: true, expiresAt: true } } } } },
      });
    });
  }

  // --- Quarantine ---

  async quarantineStock(
    tenantId: string,
    actor: AuthenticatedUser,
    input: QuarantineInput,
  ) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store || (!actor.allStoreAccess && !actor.storeIds.includes(input.storeId))) {
      throw new NotFoundException('Store not found.');
    }

    const batch = await this.prisma.productBatch.findFirst({
      where: { id: input.batchId, tenantId },
    });
    if (!batch) {
      throw new NotFoundException('Batch not found.');
    }

    const quantity = new Prisma.Decimal(input.quantity);
    if (quantity.lte(0)) {
      throw new BadRequestException('Quarantine quantity must be positive.');
    }

    return this.prisma.$transaction(async (tx) => {
      const quarantine = await tx.stockQuarantine.create({
        data: {
          tenantId,
          storeId: input.storeId,
          batchId: input.batchId,
          quantity,
          reason: input.reason.trim(),
          quarantinedByMembershipId: actor.membershipId,
        },
      });

      // Decrement batch inventory
      const batchDecrement = await tx.batchInventory.updateMany({
        where: {
          tenantId,
          storeId: input.storeId,
          batchId: input.batchId,
          quantityOnHand: { gte: quantity },
        },
        data: {
          quantityOnHand: { decrement: quantity },
        },
      });
      if (batchDecrement.count !== 1) {
        throw new BadRequestException('Insufficient batch stock to quarantine.');
      }

      const inventoryDecrement = await tx.inventoryBalance.updateMany({
        where: {
          tenantId,
          storeId: input.storeId,
          productId: batch.productId,
          quantityOnHand: { gte: quantity },
        },
        data: { quantityOnHand: { decrement: quantity } },
      });
      if (inventoryDecrement.count !== 1) {
        throw new ConflictException('Aggregate inventory changed while quarantining stock.');
      }

      await tx.stockMovement.create({
        data: {
          tenantId,
          storeId: input.storeId,
          productId: batch.productId,
          quantityDelta: quantity.neg(),
          reason: 'pharmacy_quarantine',
          reference: input.batchId,
          actorMembershipId: actor.membershipId,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'pharmacy.stock_quarantined',
          resource: 'stock_quarantine',
          resourceId: quarantine.id,
          metadata: {
            batchId: input.batchId,
            quantity: quantity.toString(),
            reason: input.reason.trim(),
          },
        },
      });

      return quarantine;
    });
  }

  async releaseQuarantine(
    tenantId: string,
    quarantineId: string,
    actor: AuthenticatedUser,
  ) {
    const quarantine = await this.prisma.stockQuarantine.findFirst({
      where: {
        id: quarantineId,
        tenantId,
        releasedAt: null,
        ...(!actor.allStoreAccess ? { storeId: { in: actor.storeIds } } : {}),
      },
      include: { batch: { select: { productId: true } } },
    });
    if (!quarantine) {
      throw new NotFoundException('Active quarantine record not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const claim = await tx.stockQuarantine.updateMany({
        where: {
          id: quarantineId,
          tenantId,
          releasedAt: null,
          ...(!actor.allStoreAccess ? { storeId: { in: actor.storeIds } } : {}),
        },
        data: {
          releasedAt: new Date(),
          releasedByMembershipId: actor.membershipId,
        },
      });
      if (claim.count !== 1) {
        throw new ConflictException('Quarantine record has already been released.');
      }

      // Restore batch inventory
      const restoredBatch = await tx.batchInventory.updateMany({
        where: {
          tenantId,
          storeId: quarantine.storeId,
          batchId: quarantine.batchId,
        },
        data: {
          quantityOnHand: { increment: quarantine.quantity },
        },
      });
      if (restoredBatch.count !== 1) {
        throw new ConflictException('Batch inventory record is missing.');
      }
      await tx.inventoryBalance.upsert({
        where: {
          tenantId_storeId_productId: {
            tenantId,
            storeId: quarantine.storeId,
            productId: quarantine.batch.productId,
          },
        },
        create: {
          tenantId,
          storeId: quarantine.storeId,
          productId: quarantine.batch.productId,
          quantityOnHand: quarantine.quantity,
        },
        update: { quantityOnHand: { increment: quarantine.quantity } },
      });
      await tx.stockMovement.create({
        data: {
          tenantId,
          storeId: quarantine.storeId,
          productId: quarantine.batch.productId,
          quantityDelta: quarantine.quantity,
          reason: 'pharmacy_quarantine_release',
          reference: quarantineId,
          actorMembershipId: actor.membershipId,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'pharmacy.quarantine_released',
          resource: 'stock_quarantine',
          resourceId: quarantineId,
          metadata: { quantity: quarantine.quantity.toString() },
        },
      });

      return { released: true };
    });
  }

  // --- Prescription Management ---

  async createPrescription(
    tenantId: string,
    actor: AuthenticatedUser,
    input: CreatePrescriptionInput,
  ) {
    const store = await this.prisma.store.findFirst({
      where: { id: input.storeId, tenantId, status: 'ACTIVE' },
    });
    if (!store || (!actor.allStoreAccess && !actor.storeIds.includes(input.storeId))) {
      throw new NotFoundException('Store not found.');
    }

    const productIds = input.items.map((i) => i.productId);
    const products = await this.prisma.product.findMany({
      where: { id: { in: productIds }, tenantId, isActive: true },
    });
    if (products.length !== productIds.length) {
      throw new NotFoundException('One or more products not found.');
    }

    for (const item of input.items) {
      const qty = new Prisma.Decimal(item.quantityPrescribed);
      if (qty.lte(0)) {
        throw new BadRequestException('Prescribed quantity must be positive.');
      }
    }

    const prescriptionNumber = `RX-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    return this.prisma.$transaction(async (tx) => {
      const prescription = await tx.prescription.create({
        data: {
          tenantId,
          storeId: input.storeId,
          prescriptionNumber,
          patientName: input.patientName?.trim() || null,
          patientId: input.patientId?.trim() || null,
          prescriberName: input.prescriberName?.trim() || null,
          prescriberLicense: input.prescriberLicense?.trim() || null,
          status: 'ACTIVE',
        },
      });

      for (const item of input.items) {
        await tx.prescriptionItem.create({
          data: {
            tenantId,
            prescriptionId: prescription.id,
            productId: item.productId,
            quantityPrescribed: new Prisma.Decimal(item.quantityPrescribed),
            quantityDispensed: new Prisma.Decimal(0),
          },
        });
      }

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'pharmacy.prescription_created',
          resource: 'prescription',
          resourceId: prescription.id,
          metadata: {
            prescriptionNumber,
            storeId: input.storeId,
            patientName: input.patientName,
            itemCount: input.items.length,
          },
        },
      });

      return tx.prescription.findUnique({
        where: { id: prescription.id },
        include: {
          items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        },
      });
    });
  }

  async listPrescriptions(
    tenantId: string,
    storeIds?: string[],
    status?: string,
    patientName?: string,
  ) {
    return this.prisma.prescription.findMany({
      where: {
        tenantId,
        ...(storeIds ? { storeId: { in: storeIds } } : {}),
        ...(status ? { status } : {}),
        ...(patientName ? { patientName: { contains: patientName, mode: 'insensitive' } } : {}),
      },
      include: {
        store: { select: { id: true, name: true, code: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        dispensingRecords: { select: { id: true, dispensedAt: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getPrescription(
    tenantId: string,
    prescriptionId: string,
    storeIds?: string[],
  ) {
    const prescription = await this.prisma.prescription.findFirst({
      where: {
        id: prescriptionId,
        tenantId,
        ...(storeIds ? { storeId: { in: storeIds } } : {}),
      },
      include: {
        store: { select: { id: true, name: true, code: true } },
        items: { include: { product: { select: { id: true, sku: true, name: true } } } },
        dispensingRecords: {
          include: { items: { include: { batch: { select: { batchNumber: true, expiresAt: true } } } } },
        },
      },
    });
    if (!prescription) {
      throw new NotFoundException('Prescription not found.');
    }
    return prescription;
  }
}
