import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaymentProviderName, PlatformPaymentProviderConfig } from './platform.types';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type PublicPlatformPaymentProvider = {
  id: string;
  provider: PaymentProviderName;
  displayName: string;
  isEnabled: boolean;
  isSandbox: boolean;
  apiKey: string | null;
  secretKey: string | null;
  publicKey: string | null;
  accountId: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
};

const DEFAULT_LABELS: Record<PaymentProviderName, string> = {
  AZAMPAY: 'AzamPay',
  STRIPE: 'Stripe',
  BANK_TRANSFER: 'Bank Transfer',
};

@Injectable()
export class PlatformPaymentProviderService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<PublicPlatformPaymentProvider[]> {
    const providers = await this.prisma.platformPaymentProvider.findMany({
      orderBy: { provider: 'asc' },
    });

    return providers.map((provider) => this.toPublic(provider));
  }

  async get(provider: PaymentProviderName): Promise<PublicPlatformPaymentProvider> {
    const record = await this.prisma.platformPaymentProvider.findUnique({
      where: { provider },
    });

    if (!record) {
      throw new NotFoundException(`Payment provider configuration for ${provider} was not found.`);
    }

    return this.toPublic(record);
  }

  async upsert(
    provider: PaymentProviderName,
    input: PlatformPaymentProviderConfig,
    actorPlatformAdminId?: string | null,
  ): Promise<PublicPlatformPaymentProvider> {
    const existing = await this.prisma.platformPaymentProvider.findUnique({
      where: { provider },
    });

    const metadata = this.mergeMetadata(existing?.metadata ?? null, input.metadata ?? null);

    const record = await this.prisma.platformPaymentProvider.upsert({
      where: { provider },
      create: {
        provider,
        displayName: this.resolveDisplayName(provider, input.displayName),
        isEnabled: input.isEnabled ?? false,
        isSandbox: input.isSandbox ?? true,
        apiKey: this.normalizeOptionalValue(input.apiKey),
        secretKey: this.normalizeOptionalValue(input.secretKey),
        publicKey: this.normalizeOptionalValue(input.publicKey),
        accountId: this.normalizeOptionalValue(input.accountId),
        metadata: metadata as Prisma.InputJsonValue,
      },
      update: {
        displayName: this.resolveDisplayName(provider, input.displayName, existing?.displayName),
        isEnabled: input.isEnabled ?? existing?.isEnabled ?? false,
        isSandbox: input.isSandbox ?? existing?.isSandbox ?? true,
        apiKey: this.normalizeOptionalValue(input.apiKey) ?? existing?.apiKey ?? null,
        secretKey: this.normalizeOptionalValue(input.secretKey) ?? existing?.secretKey ?? null,
        publicKey: this.normalizeOptionalValue(input.publicKey) ?? existing?.publicKey ?? null,
        accountId: this.normalizeOptionalValue(input.accountId) ?? existing?.accountId ?? null,
        metadata: metadata as Prisma.InputJsonValue,
      },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        actorPlatformAdminId,
        action: existing
          ? 'payment_provider.updated'
          : 'payment_provider.created',
        resource: 'platform_payment_provider',
        resourceId: record.id,
        metadata: {
          provider,
          isEnabled: record.isEnabled,
          isSandbox: record.isSandbox,
          changed: existing ? Object.keys(input).filter((k) => {
            const existingVal = (existing as any)[k];
            const inputVal = (input as any)[k];
            return JSON.stringify(existingVal) !== JSON.stringify(inputVal);
          }) : ['all'],
        },
      },
    });

    return this.toPublic(record);
  }

  /**
   * Handle an inbound payment provider webhook.
   *
   * Idempotency: if a payment already exists for the same invoice and providerRef,
   * the webhook is treated as a duplicate and no new payment is created.
   *
   * Signature verification: the raw request body must be verified using the
   * provider's configured secretKey via HMAC-SHA256 before this method is called.
   *
   * Reconciliation: matches the webhook payment to a pending invoice and marks it PAID.
   */
  async handleWebhook(
    provider: PaymentProviderName,
    input: {
      eventType: string;
      providerRef: string;
      invoiceId?: string | null;
      amount: string;
      currency: string;
      status: 'PAID' | 'FAILED' | 'CANCELED' | 'PENDING';
      metadata?: Record<string, unknown> | null;
    },
  ) {
    const providerRecord = await this.prisma.platformPaymentProvider.findUnique({
      where: { provider },
    });

    if (!providerRecord || !providerRecord.isEnabled) {
      throw new NotFoundException(`Payment provider ${provider} is not configured or enabled.`);
    }

    // Idempotency: check if a payment already exists for this invoice + providerRef
    if (input.invoiceId) {
      const existingPayment = await this.prisma.subscriptionPayment.findFirst({
        where: {
          invoiceId: input.invoiceId,
          providerReference: input.providerRef,
        },
      });
      if (existingPayment) {
        return {
          idempotent: true,
          paymentId: existingPayment.id,
          invoiceId: existingPayment.invoiceId,
          status: existingPayment.status,
          message: 'Payment already recorded for this webhook event.',
        };
      }
    }

    // Resolve invoice
    let invoice = null;
    if (input.invoiceId) {
      invoice = await this.prisma.subscriptionInvoice.findFirst({
        where: { id: input.invoiceId },
      });
      if (!invoice) {
        throw new NotFoundException(`Invoice ${input.invoiceId} not found.`);
      }
    }

    // Resolve tenant from invoice
    const tenantId = invoice?.tenantId;

    return this.prisma.$transaction(async (tx) => {
      // Determine target invoice for payment (use provided invoiceId)
      const targetInvoice = invoice || await tx.subscriptionInvoice.findFirst({
        where: { providerRef: input.providerRef },
      });

      if (!targetInvoice) {
        throw new NotFoundException(`No invoice found for provider reference ${input.providerRef}.`);
      }

      const paymentData: Prisma.SubscriptionPaymentCreateInput = {
        invoice: { connect: { id: targetInvoice.id } },
        amount: new Prisma.Decimal(input.amount),
        currency: input.currency,
        status: input.status,
        providerReference: input.providerRef,
        provider: { connect: { id: providerRecord.id } },
      };
      if (input.metadata !== undefined && input.metadata !== null) {
        paymentData.metadata = input.metadata as Prisma.InputJsonValue;
      }

      const payment = await tx.subscriptionPayment.create({
        data: paymentData,
      });

      // Reconcile invoice status
      if (input.status === 'PAID') {
        await tx.subscriptionInvoice.update({
          where: { id: targetInvoice.id },
          data: { status: 'PAID', paidAt: new Date() },
        });
      } else if (input.status === 'FAILED') {
        await tx.subscriptionInvoice.update({
          where: { id: targetInvoice.id },
          data: { status: 'FAILED' },
        });
      } else if (input.status === 'CANCELED') {
        await tx.subscriptionInvoice.update({
          where: { id: targetInvoice.id },
          data: { status: 'VOIDED' },
        });
      }

      await tx.platformAuditLog.create({
        data: {
          action: 'payment.webhook_received',
          resource: 'subscription_payment',
          resourceId: payment.id,
          metadata: {
            provider,
            eventType: input.eventType,
            providerRef: input.providerRef,
            invoiceId: targetInvoice.id,
            tenantId,
            amount: input.amount,
            status: input.status,
            idempotent: false,
          },
        },
      });

      return {
        idempotent: false,
        paymentId: payment.id,
        invoiceId: targetInvoice.id,
        status: payment.status,
        message: 'Payment recorded and invoice reconciled.',
      };
    });
  }

  /**
   * Verify an HMAC-SHA256 webhook signature against the provider's configured secretKey.
   * Returns true if the signature is valid.
   */
  async verifyWebhookSignature(
    provider: PaymentProviderName,
    payload: string,
    signature: string,
  ): Promise<boolean> {
    const hmacParts = signature.split('=');
    const providedSignature = hmacParts[hmacParts.length - 1];

    const record = await this.prisma.platformPaymentProvider.findUnique({
      where: { provider },
    });

    if (!record || !record.secretKey) {
      return false;
    }

    const expected = this.computeHmacSha256(record.secretKey, payload);
    return this.timingSafeEqual(expected, providedSignature);
  }

  private computeHmacSha256(secret: string, payload: string): string {
    return createHmac('sha256', secret).update(payload).digest('hex');
  }

  private timingSafeEqual(a: string, b: string): boolean {
    return timingSafeEqual(Buffer.from(a), Buffer.from(b));
  }

  private resolveDisplayName(
    provider: PaymentProviderName,
    input?: string | null,
    fallback?: string,
  ): string {
    const trimmed = input?.trim();
    return trimmed && trimmed.length > 0 ? trimmed : fallback ?? DEFAULT_LABELS[provider];
  }

  private normalizeOptionalValue(value?: string | null): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private mergeMetadata(
    existing: Prisma.JsonValue | null | undefined,
    incoming: Record<string, unknown> | null | undefined,
  ): Record<string, unknown> {
    const merged: Record<string, unknown> =
      existing && typeof existing === 'object' && !Array.isArray(existing)
        ? { ...(existing as Record<string, unknown>) }
        : {};

    if (incoming && Object.keys(incoming).length > 0) {
      Object.assign(merged, incoming);
    }

    return merged;
  }

  private toPublic(record: {
    id: string;
    provider: PaymentProviderName;
    displayName: string;
    isEnabled: boolean;
    isSandbox: boolean;
    apiKey: string | null;
    secretKey: string | null;
    publicKey: string | null;
    accountId: string | null;
    metadata: Prisma.JsonValue | null;
    createdAt: Date;
    updatedAt: Date;
  }): PublicPlatformPaymentProvider {
    return {
      id: record.id,
      provider: record.provider,
      displayName: record.displayName,
      isEnabled: record.isEnabled,
      isSandbox: record.isSandbox,
      apiKey: record.apiKey ? `${record.apiKey.slice(0, 6)}...` : null,
      secretKey: record.secretKey ? '***redacted***' : null,
      publicKey: record.publicKey ?? null,
      accountId: record.accountId ?? null,
      metadata: (record.metadata as Record<string, unknown>) ?? {},
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }
}
