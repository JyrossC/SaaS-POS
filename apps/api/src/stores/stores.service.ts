import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import { EntitlementService } from '../subscription/entitlement.service';

export interface CreateStoreInput {
  name: string;
  code: string;
  location?: string | null;
}

export interface UpdateStoreInput {
  name?: string;
  code?: string;
  location?: string | null;
  status?: 'ACTIVE' | 'INACTIVE';
}

export interface ListStoresInput {
  search?: string;
  page: number;
  pageSize: number;
  status?: 'ACTIVE' | 'INACTIVE';
}

@Injectable()
export class StoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly entitlementService: EntitlementService,
  ) {}

  async createStore(
    actor: AuthenticatedUser,
    input: CreateStoreInput,
  ) {
    await this.entitlementService.assertCanCreateStore(actor);

    const normalizedCode = input.code.trim().toUpperCase();
    const normalizedName = input.name.trim();

    return this.prisma.$transaction(async (tx) => {
      const existingStore = await tx.store.findFirst({
        where: { tenantId: actor.tenantId, code: normalizedCode },
        select: { id: true },
      });
      if (existingStore) {
        throw new ConflictException('A store with this code already exists.');
      }

      const store = await tx.store.create({
        data: {
          tenantId: actor.tenantId,
          name: normalizedName,
          code: normalizedCode,
          location: input.location?.trim() || null,
          status: 'ACTIVE',
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'stores.created',
          resource: 'store',
          resourceId: store.id,
          metadata: { name: store.name, code: store.code },
        },
      });

      return store;
    });
  }

  async listStores(tenantId: string, input: ListStoresInput) {
    const where: Prisma.StoreWhereInput = {
      tenantId,
      ...(input.status ? { status: input.status } : {}),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { code: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.store.findMany({
        where,
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: input.pageSize,
      }),
      this.prisma.store.count({ where }),
    ]);

    return { items, page: input.page, pageSize: input.pageSize, total };
  }

  async getStore(tenantId: string, storeId: string) {
    const store = await this.prisma.store.findFirst({
      where: { id: storeId, tenantId },
    });
    if (!store) {
      throw new NotFoundException('Store not found.');
    }
    return store;
  }

  async updateStore(
    tenantId: string,
    storeId: string,
    actor: AuthenticatedUser,
    input: UpdateStoreInput,
  ) {
    const existing = await this.getStore(tenantId, storeId);

    const data: Prisma.StoreUpdateInput = {};
    if (input.name !== undefined) data.name = input.name.trim();
    if (input.code !== undefined) data.code = input.code.trim().toUpperCase();
    if (input.location !== undefined)
      data.location = input.location?.trim() || null;
    if (input.status !== undefined) data.status = input.status;

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.store.update({
        where: { id: storeId },
        data,
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'stores.updated',
          resource: 'store',
          resourceId: store.id,
          metadata: { previous: existing, changes: input as Prisma.InputJsonValue },
        },
      });

      return store;
    });
  }

  async deactivateStore(
    tenantId: string,
    storeId: string,
    actor: AuthenticatedUser,
  ) {
    return this.updateStore(tenantId, storeId, actor, { status: 'INACTIVE' });
  }
}
