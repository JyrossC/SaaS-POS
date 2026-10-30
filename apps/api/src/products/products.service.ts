import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export interface CreateProductInput {
  sku: string;
  name: string;
  description?: string | null;
  baseUnit: string;
  sellingPrice: string;
  costPrice?: string | null;
}

export interface ListProductsInput {
  search?: string;
  page: number;
  pageSize: number;
  includeArchived: boolean;
}

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(tenantId: string, actor: AuthenticatedUser, input: CreateProductInput) {
    try {
      return await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.product.create({
          data: {
            tenantId,
            sku: input.sku.trim(),
            name: input.name.trim(),
            description: input.description?.trim() || null,
            baseUnit: input.baseUnit.trim(),
            sellingPrice: new Prisma.Decimal(input.sellingPrice),
            costPrice:
              input.costPrice === undefined || input.costPrice === null
                ? null
                : new Prisma.Decimal(input.costPrice),
          },
        });

        await transaction.auditLog.create({
          data: {
            tenantId,
            actorMembershipId: actor.membershipId,
            actorUserId: actor.id,
            action: 'products.created',
            resource: 'product',
            resourceId: product.id,
            metadata: { sku: product.sku },
          },
        });

        return product;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A product with this SKU already exists for this tenant.');
      }
      throw error;
    }
  }

  async list(tenantId: string, input: ListProductsInput) {
    const where: Prisma.ProductWhereInput = {
      tenantId,
      ...(input.includeArchived ? {} : { isActive: true }),
      ...(input.search
        ? {
            OR: [
              { name: { contains: input.search, mode: 'insensitive' } },
              { sku: { contains: input.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const skip = (input.page - 1) * input.pageSize;

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        orderBy: [{ name: 'asc' }, { id: 'asc' }],
        skip,
        take: input.pageSize,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      page: input.page,
      pageSize: input.pageSize,
      total,
    };
  }

  async getById(tenantId: string, productId: string) {
    const product = await this.prisma.product.findFirst({
      where: { id: productId, tenantId },
    });
    if (!product) {
      throw new NotFoundException('Product not found.');
    }
    return product;
  }
}
