import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { PaymentProviderName, PlatformPaymentProviderConfig } from './platform.types';

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

    return this.toPublic(record);
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
