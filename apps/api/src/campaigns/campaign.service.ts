import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';

export interface CreateCampaignInput {
  name: string;
  description?: string | null;
  type: string;
  mechanism: string;
  promoCode?: string | null;
  value: string;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  scope?: string | null;
  customerTargeting?: string | null;
  segmentIds?: string[];
  startDate: string;
  endDate?: string | null;
  recurrenceType?: string | null;
  recurrenceInterval?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  maxUsesPerCustomerPerDay?: number | null;
  maxUsesPerStore?: number | null;
  minOrderAmount?: string | null;
  minQuantity?: number | null;
  allowedPaymentMethods?: string[] | null;
  stackingRule?: string | null;
  productIds?: string[];
}

export interface UpdateCampaignInput {
  name?: string;
  description?: string | null;
  type?: string;
  mechanism?: string;
  promoCode?: string | null;
  value?: string;
  buyQuantity?: number | null;
  getQuantity?: number | null;
  scope?: string | null;
  customerTargeting?: string | null;
  segmentIds?: string[] | null;
  startDate?: string;
  endDate?: string | null;
  recurrenceType?: string | null;
  recurrenceInterval?: number | null;
  maxUses?: number | null;
  maxUsesPerCustomer?: number | null;
  maxUsesPerCustomerPerDay?: number | null;
  maxUsesPerStore?: number | null;
  minOrderAmount?: string | null;
  minQuantity?: number | null;
  allowedPaymentMethods?: string[] | null;
  stackingRule?: string | null;
  status?: string;
  productIds?: string[] | null;
}

export interface CampaignQuery {
  tenantId: string;
  storeIds?: string[];
  status?: string;
  type?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface CampaignEligibilityCheck {
  eligible: boolean;
  campaign: any;
  reason?: string;
  discountAmount: Prisma.Decimal;
}

export interface CreateCustomerSegmentInput {
  name: string;
  type: string;
  rules: Record<string, unknown>;
  description?: string | null;
}

export interface UpdateCustomerSegmentInput {
  name?: string;
  type?: string;
  rules?: Record<string, unknown>;
  description?: string | null;
}

@Injectable()
export class CampaignService {
  constructor(private readonly prisma: PrismaService) {}

  // ========================================================================
  // Campaign CRUD
  // ========================================================================

  async createCampaign(tenantId: string, actor: AuthenticatedUser, input: CreateCampaignInput) {
    // Validate date range
    const startDate = new Date(input.startDate);
    const endDate = input.endDate ? new Date(input.endDate) : null;
    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date.');
    }

    // Validate promo code uniqueness if mechanism includes PROMO_CODE
    if ((input.mechanism === 'PROMO_CODE' || input.mechanism === 'BOTH') && input.promoCode) {
      const existing = await this.prisma.campaign.findFirst({
        where: { tenantId, promoCode: input.promoCode },
      });
      if (existing) {
        throw new ConflictException(`Promo code '${input.promoCode}' already exists.`);
      }
    }

    // Validate BOGO quantities
    if (input.type === 'BUY_X_GET_Y') {
      if (!input.buyQuantity || input.buyQuantity < 1) {
        throw new BadRequestException('BOGO campaigns require a valid buy quantity.');
      }
      if (!input.getQuantity || input.getQuantity < 1) {
        throw new BadRequestException('BOGO campaigns require a valid get quantity.');
      }
    }

    // Validate percentage value
    if (input.type === 'PERCENTAGE_DISCOUNT') {
      const val = parseFloat(input.value);
      if (val <= 0 || val > 100) {
        throw new BadRequestException('Percentage discount must be between 0 and 100.');
      }
    }

    const created = await this.prisma.$transaction(async (tx) => {
      const c = await tx.campaign.create({
        data: {
          tenantId,
          name: input.name.trim(),
          description: input.description?.trim() || null,
          type: input.type as any,
          mechanism: input.mechanism as any,
          promoCode: input.promoCode?.trim() || null,
          value: new Prisma.Decimal(input.value),
          buyQuantity: input.buyQuantity ?? null,
          getQuantity: input.getQuantity ?? null,
          scope: (input.scope || 'TENANT_WIDE') as any,
          customerTargeting: (input.customerTargeting || 'ALL_CUSTOMERS') as any,
          startDate,
          endDate,
          recurrenceType: (input.recurrenceType || 'NONE') as any,
          recurrenceInterval: input.recurrenceInterval ?? null,
          maxUses: input.maxUses ?? null,
          maxUsesPerCustomer: input.maxUsesPerCustomer ?? null,
          maxUsesPerCustomerPerDay: input.maxUsesPerCustomerPerDay ?? null,
          maxUsesPerStore: input.maxUsesPerStore ?? null,
          minOrderAmount: input.minOrderAmount ? new Prisma.Decimal(input.minOrderAmount) : null,
          minQuantity: input.minQuantity ?? null,
          allowedPaymentMethods: input.allowedPaymentMethods ?? [],
          stackingRule: (input.stackingRule || 'STACKABLE') as any,
          status: 'DRAFT',
        },
      });

      // Link products
      const productIds = input.productIds ?? [];
      if (productIds.length > 0) {
        await tx.campaignProduct.createMany({
          data: productIds.map((pid) => ({
            campaignId: c.id,
            productId: pid,
            tenantId,
          })),
          skipDuplicates: true,
        });
      }

      // Link segments
      const segmentIds = input.segmentIds ?? [];
      if (segmentIds.length > 0) {
        await tx.campaignCustomerSegment.createMany({
          data: segmentIds.map((sid) => ({
            campaignId: c.id,
            segmentId: sid,
            tenantId,
          })),
          skipDuplicates: true,
        });
      }

      return c;
    });

    return this.getCampaign(tenantId, created.id);
  }

  async getCampaign(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        products: { include: { product: { select: { id: true, sku: true, name: true, sellingPrice: true } } } },
        segments: { include: { segment: true } },
        _count: { select: { usages: true } },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found.');
    }
    return campaign;
  }

  async listCampaigns(query: CampaignQuery) {
    const { tenantId, status, type, search, page = 1, pageSize = 25 } = query;
    const skip = (page - 1) * pageSize;

    const where: Prisma.CampaignWhereInput = {
      tenantId,
      ...(status ? { status: status as any } : {}),
      ...(type ? { type: type as any } : {}),
      ...(search ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
          { promoCode: { contains: search, mode: 'insensitive' } },
        ],
      } : {}),
    };

    const [campaigns, total] = await this.prisma.$transaction([
      this.prisma.campaign.findMany({
        where,
        include: {
          products: { include: { product: { select: { id: true, sku: true, name: true } } } },
          segments: { include: { segment: { select: { id: true, name: true, type: true } } } },
          _count: { select: { usages: true } },
        },
        orderBy: [{ createdAt: 'desc' }],
        skip,
        take: pageSize,
      }),
      this.prisma.campaign.count({ where }),
    ]);

    return { items: campaigns, total, page, pageSize };
  }

  async updateCampaign(tenantId: string, campaignId: string, actor: AuthenticatedUser, input: UpdateCampaignInput) {
    const existing = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Campaign not found.');
    }

    // Prevent editing active campaigns in certain ways
    if (existing.status === 'ACTIVE' && input.status !== 'PAUSED' && input.status !== 'EXPIRED') {
      throw new ConflictException('Cannot modify an active campaign. Pause or expire it first.');
    }

    // Validate promo code uniqueness
    if (input.promoCode && input.promoCode !== existing.promoCode) {
      const conflict = await this.prisma.campaign.findFirst({
        where: { tenantId, promoCode: input.promoCode },
      });
      if (conflict) {
        throw new ConflictException(`Promo code '${input.promoCode}' already exists.`);
      }
    }

    const startDate = input.startDate ? new Date(input.startDate) : existing.startDate;
    const endDate = input.endDate !== undefined ? (input.endDate ? new Date(input.endDate) : null) : existing.endDate;
    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date.');
    }

    await this.prisma.$transaction(async (tx) => {
      const c = await tx.campaign.update({
        where: { id: campaignId },
        data: {
          ...(input.name !== undefined ? { name: input.name.trim() } : {}),
          ...(input.description !== undefined ? { description: (input.description?.trim() || null) } : {}),
          ...(input.type !== undefined ? { type: input.type as any } : {}),
          ...(input.mechanism !== undefined ? { mechanism: input.mechanism as any } : {}),
          ...(input.promoCode !== undefined ? { promoCode: (input.promoCode?.trim() || null) } : {}),
          ...(input.value !== undefined ? { value: new Prisma.Decimal(input.value) } : {}),
          ...(input.buyQuantity !== undefined ? { buyQuantity: input.buyQuantity } : {}),
          ...(input.getQuantity !== undefined ? { getQuantity: input.getQuantity } : {}),
          ...(input.scope !== undefined ? { scope: input.scope as any } : {}),
          ...(input.customerTargeting !== undefined ? { customerTargeting: input.customerTargeting as any } : {}),
          ...(input.startDate !== undefined ? { startDate } : {}),
          ...(input.endDate !== undefined ? { endDate } : {}),
          ...(input.recurrenceType !== undefined ? { recurrenceType: input.recurrenceType as any } : {}),
          ...(input.recurrenceInterval !== undefined ? { recurrenceInterval: input.recurrenceInterval } : {}),
          ...(input.maxUses !== undefined ? { maxUses: input.maxUses } : {}),
          ...(input.maxUsesPerCustomer !== undefined ? { maxUsesPerCustomer: input.maxUsesPerCustomer } : {}),
          ...(input.maxUsesPerCustomerPerDay !== undefined ? { maxUsesPerCustomerPerDay: input.maxUsesPerCustomerPerDay } : {}),
          ...(input.maxUsesPerStore !== undefined ? { maxUsesPerStore: input.maxUsesPerStore } : {}),
          ...(input.minOrderAmount !== undefined ? { minOrderAmount: input.minOrderAmount ? new Prisma.Decimal(input.minOrderAmount) : null } : {}),
          ...(input.minQuantity !== undefined ? { minQuantity: input.minQuantity } : {}),
          ...(input.allowedPaymentMethods !== undefined ? { allowedPaymentMethods: input.allowedPaymentMethods ?? [] } : {}),
          ...(input.stackingRule !== undefined ? { stackingRule: input.stackingRule as any } : {}),
          ...(input.status !== undefined ? { status: input.status as any } : {}),
        },
      });

      // Relink products
      const productIds = input.productIds ?? [];
      if (input.productIds !== undefined) {
        await tx.campaignProduct.deleteMany({ where: { campaignId } });
        if (productIds.length > 0) {
          await tx.campaignProduct.createMany({
            data: productIds.map((pid) => ({
              campaignId,
              productId: pid,
              tenantId,
            })),
            skipDuplicates: true,
          });
        }
      }

      // Relink segments
      const segmentIds = input.segmentIds ?? [];
      if (input.segmentIds !== undefined) {
        await tx.campaignCustomerSegment.deleteMany({ where: { campaignId } });
        if (segmentIds.length > 0) {
          await tx.campaignCustomerSegment.createMany({
            data: segmentIds.map((sid) => ({
              campaignId,
              segmentId: sid,
              tenantId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return c;
    });

    return this.getCampaign(tenantId, campaignId);
  }

  async deleteCampaign(tenantId: string, campaignId: string) {
    const existing = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Campaign not found.');
    }
    if (existing.status === 'ACTIVE') {
      throw new ConflictException('Cannot delete an active campaign. Pause or expire it first.');
    }

    await this.prisma.campaign.delete({ where: { id: campaignId } });
    return { deleted: true };
  }

  // ========================================================================
  // Campaign Eligibility & Discount Calculation
  // ========================================================================

  async checkEligibility(
    tenantId: string,
    customerMembershipId: string | null,
    storeId: string | null,
    cartTotal: Prisma.Decimal,
    cartQuantity: number,
    paymentMethod: string | null,
    promoCode: string | null,
    productIds: string[],
  ): Promise<CampaignEligibilityCheck[]> {
    const now = new Date();

    // Fetch active campaigns that match the promo code (if provided) or all automatic campaigns
    const where: Prisma.CampaignWhereInput = {
      tenantId,
      status: 'ACTIVE',
      startDate: { lte: now },
      ...(promoCode ? { promoCode } : {}),
      OR: [
        { endDate: null },
        { endDate: { gt: now } },
      ],
    };

    const campaigns = await this.prisma.campaign.findMany({
      where,
      include: {
        products: { include: { product: true } },
        segments: { include: { segment: true } },
      },
    });

    const results: CampaignEligibilityCheck[] = [];

    for (const campaign of campaigns) {
      let discountAmount = new Prisma.Decimal(0);
      let eligible = true;
      let reason: string | undefined;

      // Check date range
      if (campaign.startDate > now) {
        eligible = false;
        reason = 'Campaign has not started yet.';
      }
      if (campaign.endDate && campaign.endDate <= now) {
        eligible = false;
        reason = 'Campaign has expired.';
      }

      // Check mechanism / promo code
      if (eligible) {
        if (campaign.mechanism === 'PROMO_CODE' && !promoCode) {
          eligible = false;
          reason = 'Promo code required.';
        }
        if (campaign.mechanism === 'AUTOMATIC' && promoCode) {
          // Automatic campaigns don't need a code; if a code was provided but doesn't match, skip
          if (campaign.promoCode && campaign.promoCode !== promoCode) {
            eligible = false;
            reason = 'Invalid promo code.';
          }
        }
        if (campaign.mechanism === 'PROMO_CODE' && promoCode && campaign.promoCode !== promoCode) {
          eligible = false;
          reason = 'Invalid promo code.';
        }
      }

      // Check product scope
      if (eligible && campaign.products.length > 0) {
        const campaignProductIds = new Set(campaign.products.map((p) => p.productId));
        const hasMatchingProduct = productIds.some((pid) => campaignProductIds.has(pid));
        if (!hasMatchingProduct) {
          eligible = false;
          reason = 'Campaign does not apply to any items in the cart.';
        }
      }

      // Check customer targeting
      if (eligible && customerMembershipId) {
        if (campaign.customerTargeting === 'LOYALTY_MEMBERS') {
          // Check if customer has a loyalty segment membership
          const loyaltySegment = await this.prisma.customerSegment.findFirst({
            where: { tenantId, type: 'LOYALTY' },
            include: { memberships: { where: { customerId: customerMembershipId } } },
          });
          if (!loyaltySegment || loyaltySegment.memberships.length === 0) {
            eligible = false;
            reason = 'Campaign is for loyalty members only.';
          }
        }
        if (eligible && campaign.customerTargeting === 'FIRST_TIME_BUYERS') {
          const priorSales = await this.prisma.sale.count({
            where: { tenantId, cashierMembershipId: customerMembershipId },
          });
          if (priorSales > 0) {
            eligible = false;
            reason = 'Campaign is for first-time buyers only.';
          }
        }
        if (eligible && campaign.customerTargeting === 'SEGMENT_BASED') {
          if (campaign.segments.length === 0) {
            eligible = false;
            reason = 'No customer segments configured for this campaign.';
          } else {
            const segmentMemberships = await this.prisma.customerSegmentMembership.findMany({
              where: {
                customerId: customerMembershipId,
                tenantId,
                segmentId: { in: campaign.segments.map((s) => s.segmentId) },
              },
            });
            if (segmentMemberships.length === 0) {
              eligible = false;
              reason = 'Customer is not in a required segment.';
            }
          }
        }
      }

      // Check usage limits
      if (eligible) {
        if (campaign.maxUses !== null && campaign.maxUses !== undefined) {
          const totalUses = await this.prisma.campaignUsage.count({
            where: { campaignId: campaign.id, tenantId },
          });
          if (totalUses >= campaign.maxUses) {
            eligible = false;
            reason = 'Campaign usage limit reached.';
          }
        }
        if (eligible && customerMembershipId && campaign.maxUsesPerCustomer !== null && campaign.maxUsesPerCustomer !== undefined) {
          const customerUses = await this.prisma.campaignUsage.count({
            where: { campaignId: campaign.id, tenantId, customerId: customerMembershipId },
          });
          if (customerUses >= campaign.maxUsesPerCustomer) {
            eligible = false;
            reason = 'Customer usage limit reached.';
          }
        }
        if (eligible && customerMembershipId && campaign.maxUsesPerCustomerPerDay !== null && campaign.maxUsesPerCustomerPerDay !== undefined) {
          const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          const customerUsesToday = await this.prisma.campaignUsage.count({
            where: {
              campaignId: campaign.id,
              tenantId,
              customerId: customerMembershipId,
              usedAt: { gte: todayStart },
            },
          });
          if (customerUsesToday >= campaign.maxUsesPerCustomerPerDay) {
            eligible = false;
            reason = 'Daily customer usage limit reached.';
          }
        }
        if (eligible && storeId && campaign.maxUsesPerStore !== null && campaign.maxUsesPerStore !== undefined) {
          const storeUses = await this.prisma.campaignUsage.count({
            where: { campaignId: campaign.id, tenantId, storeId },
          });
          if (storeUses >= campaign.maxUsesPerStore) {
            eligible = false;
            reason = 'Store usage limit reached.';
          }
        }
      }

      // Check conditions (min order amount, min quantity, payment methods)
      if (eligible) {
        if (campaign.minOrderAmount !== null && campaign.minOrderAmount !== undefined) {
          if (cartTotal.lt(campaign.minOrderAmount)) {
            eligible = false;
            reason = `Minimum order amount of ${campaign.minOrderAmount} not met.`;
          }
        }
        if (eligible && campaign.minQuantity !== null && campaign.minQuantity !== undefined) {
          if (cartQuantity < campaign.minQuantity) {
            eligible = false;
            reason = `Minimum quantity of ${campaign.minQuantity} not met.`;
          }
        }
        if (eligible && campaign.allowedPaymentMethods && campaign.allowedPaymentMethods.length > 0) {
          if (!paymentMethod || !campaign.allowedPaymentMethods.includes(paymentMethod)) {
            eligible = false;
            reason = `Payment method '${paymentMethod}' not eligible for this campaign.`;
          }
        }
      }

      // Calculate discount amount if eligible
      if (eligible) {
        discountAmount = this.calculateDiscount(campaign, cartTotal, cartQuantity, productIds);
      }

      results.push({
        eligible,
        campaign: {
          id: campaign.id,
          name: campaign.name,
          type: campaign.type,
          mechanism: campaign.mechanism,
          promoCode: campaign.promoCode,
          value: campaign.value,
          stackingRule: campaign.stackingRule,
        },
        reason,
        discountAmount,
      });
    }

    return results;
  }

  private calculateDiscount(
    campaign: any,
    cartTotal: Prisma.Decimal,
    cartQuantity: number,
    _productIds: string[],
  ): Prisma.Decimal {
    const value = campaign.value;
    const type = campaign.type;

    switch (type) {
      case 'PERCENTAGE_DISCOUNT':
        return cartTotal.mul(value).div(100);
      case 'FIXED_AMOUNT_DISCOUNT':
        return value.lt(cartTotal) ? value : cartTotal;
      case 'BUY_X_GET_Y': {
        const buyQty = campaign.buyQuantity || 1;
        const getQty = campaign.getQuantity || 1;
        const sets = Math.floor(cartQuantity / (buyQty + getQty));
        const freeItems = sets * getQty;
        // Discount = value * free items (assuming value is the discount per free item)
        return new Prisma.Decimal(value).mul(freeItems);
      }
      case 'BUNDLE_PRICING':
        return value; // Bundle discount is a fixed amount off the bundle
      case 'TIERED_SPEND': {
        // Tiered: value represents the discount at this tier
        return value;
      }
      default:
        return new Prisma.Decimal(0);
    }
  }

  async recordUsage(
    tenantId: string,
    campaignId: string,
    data: {
      customerId?: string | null;
      storeId?: string | null;
      saleId?: string | null;
      discountAmount: string;
    },
  ) {
    return this.prisma.campaignUsage.create({
      data: {
        campaignId,
        tenantId,
        customerId: data.customerId || null,
        storeId: data.storeId || null,
        saleId: data.saleId || null,
        discountAmount: new Prisma.Decimal(data.discountAmount),
      },
      include: { campaign: { select: { id: true, name: true } } },
    });
  }

  // ========================================================================
  // Customer Segment CRUD
  // ========================================================================

  async createCustomerSegment(tenantId: string, actor: AuthenticatedUser, input: CreateCustomerSegmentInput) {
    const segment = await this.prisma.customerSegment.create({
      data: {
        tenantId,
        name: input.name.trim(),
        type: input.type as any,
        rules: input.rules as Prisma.InputJsonValue,
        description: input.description?.trim() || null,
      },
    });
    return segment;
  }

  async listCustomerSegments(tenantId: string, type?: string) {
    const where: Prisma.CustomerSegmentWhereInput = { tenantId };
    if (type) {
      where.type = type as any;
    }
    return this.prisma.customerSegment.findMany({
      where,
      include: {
        _count: { select: { memberships: true, campaigns: true } },
      },
      orderBy: [{ createdAt: 'desc' }],
    });
  }

  async getCustomerSegment(tenantId: string, segmentId: string) {
    const segment = await this.prisma.customerSegment.findFirst({
      where: { id: segmentId, tenantId },
      include: {
        memberships: { select: { customerId: true, joinedAt: true } },
        campaigns: { select: { campaign: { select: { id: true, name: true, status: true } } } },
      },
    });
    if (!segment) {
      throw new NotFoundException('Customer segment not found.');
    }
    return segment;
  }

  async updateCustomerSegment(tenantId: string, segmentId: string, input: UpdateCustomerSegmentInput) {
    const existing = await this.prisma.customerSegment.findFirst({
      where: { id: segmentId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Customer segment not found.');
    }

    return this.prisma.customerSegment.update({
      where: { id: segmentId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.type !== undefined ? { type: input.type as any } : {}),
        ...(input.rules !== undefined ? { rules: input.rules as Prisma.InputJsonValue } : {}),
        ...(input.description !== undefined ? { description: (input.description?.trim() || null) } : {}),
      },
    });
  }

  async deleteCustomerSegment(tenantId: string, segmentId: string) {
    const existing = await this.prisma.customerSegment.findFirst({
      where: { id: segmentId, tenantId },
    });
    if (!existing) {
      throw new NotFoundException('Customer segment not found.');
    }
    await this.prisma.customerSegment.delete({ where: { id: segmentId } });
    return { deleted: true };
  }

  async addCustomerToSegment(tenantId: string, segmentId: string, customerMembershipId: string) {
    const segment = await this.prisma.customerSegment.findFirst({
      where: { id: segmentId, tenantId },
    });
    if (!segment) {
      throw new NotFoundException('Segment not found.');
    }

    return this.prisma.customerSegmentMembership.upsert({
      where: { segmentId_customerId: { segmentId, customerId: customerMembershipId } },
      update: {},
      create: {
        segmentId,
        customerId: customerMembershipId,
        tenantId,
      },
    });
  }

  async removeCustomerFromSegment(tenantId: string, segmentId: string, customerMembershipId: string) {
    await this.prisma.customerSegmentMembership.delete({
      where: { segmentId_customerId: { segmentId, customerId: customerMembershipId } },
    });
    return { removed: true };
  }

  // ========================================================================
  // Campaign Analytics
  // ========================================================================

  async getCampaignAnalytics(tenantId: string, campaignId: string) {
    const campaign = await this.prisma.campaign.findFirst({
      where: { id: campaignId, tenantId },
      include: {
        _count: { select: { usages: true } },
        usages: {
          select: { id: true, discountAmount: true, usedAt: true, customerId: true, storeId: true },
          orderBy: { usedAt: 'desc' },
          take: 50,
        },
      },
    });
    if (!campaign) {
      throw new NotFoundException('Campaign not found.');
    }

    const totalDiscount = campaign.usages.reduce(
      (sum: Prisma.Decimal, u: any) => sum.add(u.discountAmount),
      new Prisma.Decimal(0),
    );

    const uniqueCustomers = new Set(campaign.usages.map((u: any) => u.customerId).filter(Boolean));

    return {
      campaign: {
        id: campaign.id,
        name: campaign.name,
        status: campaign.status,
        type: campaign.type,
        mechanism: campaign.mechanism,
        startDate: campaign.startDate,
        endDate: campaign.endDate,
      },
      totalUses: campaign._count.usages,
      totalDiscount: totalDiscount.toString(),
      uniqueCustomers: uniqueCustomers.size,
      recentUsages: campaign.usages.map((u: any) => ({
        id: u.id,
        discountAmount: u.discountAmount.toString(),
        usedAt: u.usedAt,
        customerId: u.customerId,
        storeId: u.storeId,
      })),
    };
  }
}
