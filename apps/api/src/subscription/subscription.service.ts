import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';

export interface ChangePlanInput {
  planCode: string;
}

export interface RenewSubscriptionInput {
  planCode?: string;
}

@Injectable()
export class SubscriptionService {
  constructor(private readonly prisma: PrismaService) {}

  async getSubscriptionDetails(tenantId: string) {
    const subscription = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId },
      include: {
        planVersion: {
          include: {
            plan: true,
            entitlements: true,
          },
        },
      },
      orderBy: { startsAt: 'desc' },
    });

    if (!subscription) {
      throw new NotFoundException('No subscription found for this tenant.');
    }

    const now = new Date();
    const isCurrent =
      subscription.startsAt <= now &&
      (subscription.endsAt === null || subscription.endsAt > now);

    return {
      id: subscription.id,
      planCode: subscription.planVersion.plan.code,
      planName: subscription.planVersion.plan.name,
      planVersion: subscription.planVersion.version,
      status: subscription.status,
      startsAt: subscription.startsAt,
      endsAt: subscription.endsAt,
      trialEndsAt: subscription.trialEndsAt,
      isCurrent,
      entitlements: Object.fromEntries(
        subscription.planVersion.entitlements.map((e) => [e.key, e.value]),
      ),
      limits: Object.fromEntries(
        subscription.planVersion.entitlements
          .filter((e) => e.key.startsWith('limit.') && typeof e.value === 'number')
          .map((e) => [e.key.slice('limit.'.length), e.value]),
      ),
    };
  }

  async changePlan(tenantId: string, actor: AuthenticatedUser, input: ChangePlanInput) {
    const targetPlan = await this.prisma.subscriptionPlan.findFirst({
      where: { code: input.planCode },
      include: {
        versions: {
          where: { isActive: true },
          orderBy: { version: 'desc' },
          take: 1,
        },
      },
    });

    if (!targetPlan || targetPlan.versions.length === 0) {
      throw new NotFoundException('Target plan not found or inactive.');
    }

    const targetVersion = targetPlan.versions[0];

    return this.prisma.$transaction(async (tx) => {
      const currentSub = await tx.tenantSubscription.findFirst({
        where: { tenantId },
        include: { planVersion: { include: { plan: true } } },
        orderBy: { startsAt: 'desc' },
      });

      if (!currentSub) {
        throw new NotFoundException('No active subscription found.');
      }

      const now = new Date();
      const trialEndsAt =
        targetVersion.trialDays > 0
          ? new Date(now.getTime() + targetVersion.trialDays * 24 * 60 * 60 * 1000)
          : null;

      const endsAt =
        targetVersion.billingPeriodDays > 0
          ? new Date(now.getTime() + targetVersion.billingPeriodDays * 24 * 60 * 60 * 1000)
          : null;

      // Update current subscription to ended
      await tx.tenantSubscription.update({
        where: { id: currentSub.id },
        data: {
          status: 'CANCELED',
          endsAt: now,
        },
      });

      // Create new subscription
      const newSub = await tx.tenantSubscription.create({
        data: {
          tenantId,
          planVersionId: targetVersion.id,
          status: targetVersion.trialDays > 0 ? 'TRIALING' : 'ACTIVE',
          startsAt: now,
          endsAt,
          trialEndsAt,
        },
      });

      // Create invoice
      await tx.subscriptionInvoice.create({
        data: {
          tenantId,
          subscriptionId: newSub.id,
          amount: targetVersion.price ?? new Prisma.Decimal(0),
          currency: targetVersion.currency,
          status: 'PENDING_PAYMENT',
          dueAt: endsAt,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'subscription.plan_changed',
          resource: 'tenant_subscription',
          resourceId: newSub.id,
          metadata: {
            fromPlan: currentSub.planVersionId,
            toPlan: targetVersion.id,
            toPlanCode: input.planCode,
          },
        },
      });

      return newSub;
    });
  }

  async renewSubscription(tenantId: string, actor: AuthenticatedUser, input: RenewSubscriptionInput) {
    return this.prisma.$transaction(async (tx) => {
      const currentSub = await tx.tenantSubscription.findFirst({
        where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
        include: { planVersion: { include: { plan: true } } },
        orderBy: { startsAt: 'desc' },
      });

      if (!currentSub) {
        throw new NotFoundException('No active subscription to renew.');
      }

      let targetVersion = currentSub.planVersion;
      if (input.planCode && input.planCode !== currentSub.planVersion.plan.code) {
        const targetPlan = await tx.subscriptionPlan.findFirst({
          where: { code: input.planCode },
          include: {
            versions: {
              where: { isActive: true },
              orderBy: { version: 'desc' },
              take: 1,
              include: { plan: true },
            },
          },
        });
        if (!targetPlan || targetPlan.versions.length === 0) {
          throw new NotFoundException('Target plan not found.');
        }
        targetVersion = targetPlan.versions[0];
      }

      const now = new Date();
      const baseDate = currentSub.endsAt && currentSub.endsAt > now ? currentSub.endsAt : now;
      const newEndsAt = new Date(
        baseDate.getTime() + targetVersion.billingPeriodDays * 24 * 60 * 60 * 1000,
      );

      const updated = await tx.tenantSubscription.update({
        where: { id: currentSub.id },
        data: {
          status: 'ACTIVE',
          endsAt: newEndsAt,
          planVersionId: targetVersion.id,
        },
      });

      await tx.subscriptionInvoice.create({
        data: {
          tenantId,
          subscriptionId: updated.id,
          amount: targetVersion.price ?? new Prisma.Decimal(0),
          currency: targetVersion.currency,
          status: 'PENDING_PAYMENT',
          dueAt: newEndsAt,
        },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'subscription.renewed',
          resource: 'tenant_subscription',
          resourceId: updated.id,
          metadata: {
            planCode: targetVersion.plan.code,
            newEndsAt: newEndsAt.toISOString(),
          },
        },
      });

      return updated;
    });
  }

  async suspendSubscription(tenantId: string, actor: AuthenticatedUser, reason: string) {
    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId, status: { in: ['ACTIVE', 'TRIALING'] } },
      orderBy: { startsAt: 'desc' },
    });
    if (!sub) {
      throw new NotFoundException('No active subscription to suspend.');
    }

    const updated = await this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { status: 'SUSPENDED' },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.id,
        action: 'subscription.suspended',
        resource: 'tenant_subscription',
        resourceId: sub.id,
        metadata: { reason },
      },
    });

    return updated;
  }

  async reactivateSubscription(tenantId: string, actor: AuthenticatedUser) {
    const sub = await this.prisma.tenantSubscription.findFirst({
      where: { tenantId, status: 'SUSPENDED' },
      orderBy: { startsAt: 'desc' },
    });
    if (!sub) {
      throw new NotFoundException('No suspended subscription to reactivate.');
    }

    const updated = await this.prisma.tenantSubscription.update({
      where: { id: sub.id },
      data: { status: 'ACTIVE' },
    });

    await this.prisma.auditLog.create({
      data: {
        tenantId,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.id,
        action: 'subscription.reactivated',
        resource: 'tenant_subscription',
        resourceId: sub.id,
      },
    });

    return updated;
  }

  async getInvoices(tenantId: string, page = 1, pageSize = 25) {
    const skip = (page - 1) * pageSize;
    const [items, total] = await this.prisma.$transaction([
      this.prisma.subscriptionInvoice.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: pageSize,
      }),
      this.prisma.subscriptionInvoice.count({ where: { tenantId } }),
    ]);
    return { items, page, pageSize, total };
  }

  async recordPayment(
    tenantId: string,
    invoiceId: string,
    actor: AuthenticatedUser,
    amount: string,
    providerReference?: string | null,
  ) {
    const invoice = await this.prisma.subscriptionInvoice.findFirst({
      where: { id: invoiceId, tenantId },
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found.');
    }

    return this.prisma.$transaction(async (tx) => {
      const payment = await tx.subscriptionPayment.create({
        data: {
          invoiceId,
          amount: new Prisma.Decimal(amount),
          currency: invoice.currency,
          status: 'PAID',
          providerReference: providerReference?.trim() || null,
        },
      });

      await tx.subscriptionInvoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID', paidAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'subscription.payment_recorded',
          resource: 'subscription_invoice',
          resourceId: invoiceId,
          metadata: { amount, providerReference },
        },
      });

      return payment;
    });
  }
}
