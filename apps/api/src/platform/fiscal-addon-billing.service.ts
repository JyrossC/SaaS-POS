import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma, FiscalAddonBillingPeriod } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  FiscalAddonBillingPeriod as BillingPeriod,
  FiscalAddonCheckoutRequest,
  FiscalAddonPaymentSimulationRequest,
  FiscalAddonPaymentOutcome,
} from './platform.types';
import { FiscalSimulatorService } from './fiscal-simulator.service';

const OFFER_ID = 'fiscalization';

@Injectable()
export class FiscalAddonBillingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalSimulator: FiscalSimulatorService,
  ) {}

  async listTenantSubscriptions(tenantId: string) {
    if (!this.fiscalSimulator.isTestBillingEnabled()) return [];
    const subscriptions = await this.prisma.fiscalAddonSubscription.findMany({
      where: { tenantId },
      include: {
        invoices: {
          orderBy: { createdAt: 'desc' },
          take: 20,
          include: {
            payments: { orderBy: { createdAt: 'desc' }, take: 5 },
          },
        },
      },
      orderBy: { updatedAt: 'desc' },
    });

    return subscriptions.map((subscription) => ({
      ...subscription,
      amount: subscription.amount.toString(),
      invoices: subscription.invoices.map((invoice) => ({
        ...invoice,
        amount: invoice.amount.toString(),
        payments: invoice.payments.map((payment) => ({
          ...payment,
          amount: payment.amount.toString(),
        })),
      })),
    }));
  }

  async startCheckout(actor: AuthenticatedUser, input: FiscalAddonCheckoutRequest) {
    this.assertTestBillingEnabled();
    const offer = await this.getAvailableTestOffer();
    const price = this.priceForPeriod(offer, input.billingPeriod);
    if (!price) {
      throw new BadRequestException(`No ${input.billingPeriod.toLowerCase()} test price is configured.`);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        let subscription = await tx.fiscalAddonSubscription.findUnique({
          where: {
            tenantId_jurisdiction: {
              tenantId: actor.tenantId,
              jurisdiction: input.jurisdiction,
            },
          },
        });

        if (subscription && ['ACTIVE', 'PAST_DUE'].includes(subscription.status)) {
          throw new ConflictException(
            'A fiscal add-on subscription already exists for this jurisdiction. Use the renewal action instead.',
          );
        }

        if (subscription?.status === 'PENDING_PAYMENT') {
          const pendingInvoice = await tx.subscriptionInvoice.findFirst({
            where: {
              fiscalAddonSubscriptionId: subscription.id,
              status: 'PENDING_PAYMENT',
            },
            orderBy: { createdAt: 'desc' },
          });
          if (pendingInvoice) return this.publicInvoice(pendingInvoice);
        }

        if (!subscription) {
          subscription = await tx.fiscalAddonSubscription.create({
            data: {
              tenantId: actor.tenantId,
              jurisdiction: input.jurisdiction,
              billingPeriod: input.billingPeriod,
              status: 'PENDING_PAYMENT',
              amount: new Prisma.Decimal(price),
              currency: offer.currency,
              isTestMode: true,
            },
          });
        } else {
          subscription = await tx.fiscalAddonSubscription.update({
            where: { id: subscription.id },
            data: {
              billingPeriod: input.billingPeriod,
              status: 'PENDING_PAYMENT',
              amount: new Prisma.Decimal(price),
              currency: offer.currency,
              currentPeriodStartsAt: null,
              currentPeriodEndsAt: null,
              cancelAtPeriodEnd: false,
              canceledAt: null,
            },
          });
        }

        const now = new Date();
        const invoice = await this.createInvoice(tx, actor.tenantId, subscription, now);
        await this.audit(actor, tx, subscription.id, 'fiscal_addon.checkout_started', {
          invoiceId: invoice.id,
          billingPeriod: subscription.billingPeriod,
          amount: subscription.amount.toString(),
          currency: subscription.currency,
        });
        return invoice;
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A fiscal add-on checkout is already being created.');
      }
      throw error;
    }
  }

  async renew(actor: AuthenticatedUser, subscriptionId: string) {
    this.assertTestBillingEnabled();
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.fiscalAddonSubscription.findFirst({
        where: { id: subscriptionId, tenantId: actor.tenantId },
      });
      if (!subscription) throw new NotFoundException('Fiscal add-on subscription not found.');
      if (!['ACTIVE', 'PAST_DUE'].includes(subscription.status)) {
        throw new ConflictException('Only an active or past-due subscription can be renewed.');
      }
      if (subscription.cancelAtPeriodEnd) {
        throw new ConflictException('Resume the subscription before creating a renewal invoice.');
      }
      const pendingInvoice = await tx.subscriptionInvoice.findFirst({
        where: { fiscalAddonSubscriptionId: subscription.id, status: 'PENDING_PAYMENT' },
        orderBy: { createdAt: 'desc' },
      });
      if (pendingInvoice) return this.publicInvoice(pendingInvoice);

      const now = new Date();
      const periodStart =
        subscription.currentPeriodEndsAt && subscription.currentPeriodEndsAt > now
          ? subscription.currentPeriodEndsAt
          : now;
      const invoice = await this.createInvoice(tx, actor.tenantId, subscription, periodStart);
      await this.audit(actor, tx, subscription.id, 'fiscal_addon.renewal_invoice_created', {
        invoiceId: invoice.id,
        billingPeriod: subscription.billingPeriod,
        amount: subscription.amount.toString(),
        currency: subscription.currency,
      });
      return invoice;
    });
  }

  async simulatePayment(
    actor: AuthenticatedUser,
    invoiceId: string,
    input: FiscalAddonPaymentSimulationRequest,
  ) {
    this.assertTestBillingEnabled();
    return this.prisma.$transaction(async (tx) => {
      const providerReference = `fiscal-test:${invoiceId}:${input.idempotencyKey}`;
      const existingPayment = await tx.subscriptionPayment.findFirst({
        where: { invoice: { tenantId: actor.tenantId }, providerReference },
        include: { invoice: { include: { fiscalAddonSubscription: true } } },
      });
      if (existingPayment) {
        return {
          idempotent: true,
          payment: {
            ...existingPayment,
            amount: existingPayment.amount.toString(),
          },
          invoice: this.publicInvoice(existingPayment.invoice),
          subscriptionStatus:
            existingPayment.invoice.fiscalAddonSubscription?.status ?? 'PENDING_PAYMENT',
          simulationOnly: true as const,
          realChargeMade: false as const,
        };
      }

      const invoice = await tx.subscriptionInvoice.findFirst({
        where: {
          id: invoiceId,
          tenantId: actor.tenantId,
          isTestMode: true,
          fiscalAddonSubscriptionId: { not: null },
        },
        include: { fiscalAddonSubscription: true },
      });
      if (!invoice?.fiscalAddonSubscription) {
        throw new NotFoundException('Test fiscal add-on invoice not found.');
      }
      if (invoice.status !== 'PENDING_PAYMENT') {
        throw new ConflictException('Only pending invoices can receive a simulated payment result.');
      }

      const now = new Date();
      const paymentStatus = this.paymentStatus(input.outcome);
      const payment = await tx.subscriptionPayment.create({
        data: {
          invoiceId: invoice.id,
          providerReference,
          status: paymentStatus,
          amount: invoice.amount,
          currency: invoice.currency,
          isTestMode: true,
          metadata: {
            source: 'FISCAL_ADDON_TEST_SIMULATOR',
            outcome: input.outcome,
            testOnly: true,
          },
        },
      });

      let updatedInvoice = invoice;
      const subscription = invoice.fiscalAddonSubscription;
      if (input.outcome === 'PAID') {
        updatedInvoice = await tx.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: { status: 'PAID', paidAt: now },
          include: { fiscalAddonSubscription: true },
        });
        await tx.fiscalAddonSubscription.update({
          where: { id: subscription.id },
          data: {
            status: 'ACTIVE',
            billingPeriod: invoice.fiscalBillingPeriod ?? subscription.billingPeriod,
            currentPeriodStartsAt: invoice.fiscalPeriodStartsAt ?? now,
            currentPeriodEndsAt: invoice.fiscalPeriodEndsAt ?? this.addPeriod(
              now,
              invoice.fiscalBillingPeriod ?? subscription.billingPeriod,
            ),
          },
        });
      } else if (input.outcome === 'FAILED') {
        updatedInvoice = await tx.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: { status: 'FAILED' },
          include: { fiscalAddonSubscription: true },
        });
        if (subscription.status === 'ACTIVE') {
          await tx.fiscalAddonSubscription.update({
            where: { id: subscription.id },
            data: { status: 'PAST_DUE' },
          });
        }
      } else if (input.outcome === 'CANCELED') {
        updatedInvoice = await tx.subscriptionInvoice.update({
          where: { id: invoice.id },
          data: { status: 'VOIDED' },
          include: { fiscalAddonSubscription: true },
        });
        if (subscription.status === 'PENDING_PAYMENT') {
          await tx.fiscalAddonSubscription.update({
            where: { id: subscription.id },
            data: { status: 'CANCELED', canceledAt: now },
          });
        }
      }

      await tx.auditLog.create({
        data: {
          tenantId: actor.tenantId,
          actorMembershipId: actor.membershipId,
          actorUserId: actor.id,
          action: 'fiscal_addon.payment_simulated',
          resource: 'subscription_payment',
          resourceId: payment.id,
          metadata: {
            subscriptionId: subscription.id,
            invoiceId: invoice.id,
            outcome: input.outcome,
            amount: invoice.amount.toString(),
            currency: invoice.currency,
            testOnly: true,
          },
        },
      });

      return {
        idempotent: false,
        payment: { ...payment, amount: payment.amount.toString() },
        invoice: this.publicInvoice(updatedInvoice),
        subscriptionStatus:
          input.outcome === 'PAID'
            ? 'ACTIVE'
            : input.outcome === 'CANCELED' && subscription.status === 'PENDING_PAYMENT'
              ? 'CANCELED'
              : input.outcome === 'FAILED' && subscription.status === 'ACTIVE'
                ? 'PAST_DUE'
                : subscription.status,
        simulationOnly: true as const,
        realChargeMade: false as const,
      };
    });
  }

  async cancel(actor: AuthenticatedUser, subscriptionId: string) {
    this.assertTestBillingEnabled();
    return this.prisma.$transaction(async (tx) => {
      const subscription = await tx.fiscalAddonSubscription.findFirst({
        where: { id: subscriptionId, tenantId: actor.tenantId },
      });
      if (!subscription) throw new NotFoundException('Fiscal add-on subscription not found.');
      if (subscription.status === 'PENDING_PAYMENT') {
        const pendingInvoices = await tx.subscriptionInvoice.findMany({
          where: {
            fiscalAddonSubscriptionId: subscription.id,
            status: 'PENDING_PAYMENT',
          },
          select: { id: true },
        });
        await tx.subscriptionInvoice.updateMany({
          where: { id: { in: pendingInvoices.map(({ id }) => id) } },
          data: { status: 'VOIDED' },
        });
        await tx.subscriptionPayment.updateMany({
          where: {
            invoiceId: { in: pendingInvoices.map(({ id }) => id) },
            status: 'PENDING',
          },
          data: { status: 'CANCELED' },
        });
        await tx.fiscalAddonSubscription.update({
          where: { id: subscription.id },
          data: { status: 'CANCELED', canceledAt: new Date() },
        });
      } else if (subscription.status === 'ACTIVE' || subscription.status === 'PAST_DUE') {
        await tx.fiscalAddonSubscription.update({
          where: { id: subscription.id },
          data: { cancelAtPeriodEnd: true },
        });
      } else {
        throw new ConflictException('This subscription cannot be canceled in its current state.');
      }
      await this.audit(actor, tx, subscription.id, 'fiscal_addon.cancellation_requested', {
        cancellationAtPeriodEnd: subscription.status !== 'PENDING_PAYMENT',
      });
      return {
        canceled: true,
        cancellationAtPeriodEnd: subscription.status !== 'PENDING_PAYMENT',
        id: subscription.id,
        status: subscription.status === 'PENDING_PAYMENT' ? 'CANCELED' : subscription.status,
        cancelAtPeriodEnd: subscription.status !== 'PENDING_PAYMENT',
      };
    });
  }

  async resume(actor: AuthenticatedUser, subscriptionId: string) {
    this.assertTestBillingEnabled();
    const subscription = await this.prisma.fiscalAddonSubscription.findFirst({
      where: { id: subscriptionId, tenantId: actor.tenantId },
    });
    if (!subscription) throw new NotFoundException('Fiscal add-on subscription not found.');
    if (!subscription.cancelAtPeriodEnd || subscription.status !== 'ACTIVE') {
      throw new ConflictException('Only a cancellation scheduled for an active subscription can be resumed.');
    }
    const updated = await this.prisma.$transaction(async (tx) => {
      const result = await tx.fiscalAddonSubscription.update({
        where: { id: subscription.id },
        data: { cancelAtPeriodEnd: false },
      });
      await this.audit(actor, tx, result.id, 'fiscal_addon.cancellation_resumed');
      return result;
    });
    return {
      canceled: false,
      cancellationAtPeriodEnd: false,
      id: updated.id,
      status: updated.status,
      cancelAtPeriodEnd: updated.cancelAtPeriodEnd,
    };
  }

  private async createInvoice(
    tx: Prisma.TransactionClient,
    tenantId: string,
    subscription: {
      id: string;
      jurisdiction: 'MAINLAND_TANZANIA' | 'ZANZIBAR';
      billingPeriod: FiscalAddonBillingPeriod;
      amount: Prisma.Decimal;
      currency: string;
    },
    periodStartsAt: Date,
  ) {
    const invoice = await tx.subscriptionInvoice.create({
      data: {
        tenantId,
        fiscalAddonSubscriptionId: subscription.id,
        fiscalBillingPeriod: subscription.billingPeriod,
        fiscalPeriodStartsAt: periodStartsAt,
        fiscalPeriodEndsAt: this.addPeriod(periodStartsAt, subscription.billingPeriod),
        amount: subscription.amount,
        currency: subscription.currency,
        isTestMode: true,
        status: 'PENDING_PAYMENT',
        metadata: {
          product: 'FISCALIZATION_ADDON',
          jurisdiction: subscription.jurisdiction,
          testOnly: true,
        },
      },
    });
    return this.publicInvoice(invoice);
  }

  private async getAvailableTestOffer() {
    const offer = await this.prisma.fiscalAddonOffer.findUnique({ where: { id: OFFER_ID } });
    if (!offer?.isAvailable || !offer.isTestOnly) {
      throw new ServiceUnavailableException('The test fiscal add-on offer is not currently available.');
    }
    return offer;
  }

  private priceForPeriod(
    offer: { monthlyPrice: Prisma.Decimal | null; annualPrice: Prisma.Decimal | null },
    period: BillingPeriod,
  ) {
    const value = period === 'MONTHLY' ? offer.monthlyPrice : offer.annualPrice;
    return value?.toString() ?? null;
  }

  private assertTestBillingEnabled() {
    if (!this.fiscalSimulator.isTestBillingEnabled()) {
      throw new ServiceUnavailableException(
        'Test billing is available only when explicitly enabled in development or test environments.',
      );
    }
  }

  private paymentStatus(outcome: FiscalAddonPaymentOutcome) {
    if (outcome === 'PAID') return 'PAID' as const;
    if (outcome === 'FAILED') return 'FAILED' as const;
    if (outcome === 'CANCELED') return 'CANCELED' as const;
    return 'PENDING' as const;
  }

  private addPeriod(start: Date, period: FiscalAddonBillingPeriod) {
    const result = new Date(start);
    const day = result.getUTCDate();
    result.setUTCDate(1);
    if (period === 'MONTHLY') result.setUTCMonth(result.getUTCMonth() + 1);
    else result.setUTCFullYear(result.getUTCFullYear() + 1);
    const lastDay = new Date(Date.UTC(
      result.getUTCFullYear(),
      result.getUTCMonth() + 1,
      0,
    )).getUTCDate();
    result.setUTCDate(Math.min(day, lastDay));
    return result;
  }

  private publicInvoice<T extends { amount: Prisma.Decimal }>(invoice: T) {
    return { ...invoice, amount: invoice.amount.toString() };
  }

  private async audit(
    actor: AuthenticatedUser,
    tx: Prisma.TransactionClient,
    subscriptionId: string,
    action: string,
    extra: Prisma.InputJsonObject = {},
  ) {
    await tx.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.id,
        action,
        resource: 'fiscal_addon_subscription',
        resourceId: subscriptionId,
        metadata: { testOnly: true, ...extra },
      },
    });
  }
}
