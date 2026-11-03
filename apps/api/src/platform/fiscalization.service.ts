import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthenticatedUser } from '../auth/auth.types';
import { PrismaService } from '../database/prisma.service';
import {
  FiscalAddonOfferRequest,
  FiscalAddonRequestUpdate,
  FiscalJurisdiction,
  FiscalProviderConfigurationRequest,
  FiscalSimulationRequest,
  TenantFiscalAddonRequestCreate,
  TenantFiscalProfileRequest,
} from './platform.types';
import { encryptFiscalCredentials } from './fiscal-credential-crypto';
import { FiscalSimulatorService } from './fiscal-simulator.service';

const ADDON_OFFER_ID = 'fiscalization';

@Injectable()
export class FiscalizationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly fiscalSimulator: FiscalSimulatorService,
  ) {}

  async getPlatformConfiguration() {
    const [providers, offer, requests, subscriptions] = await Promise.all([
      this.prisma.fiscalProviderConfiguration.findMany({
        orderBy: { jurisdiction: 'asc' },
        select: {
          id: true,
          jurisdiction: true,
          providerName: true,
          productionEndpoint: true,
          sandboxEndpoint: true,
          documentationUrl: true,
          approvalStatus: true,
          approvalEvidenceReference: true,
          isAvailable: true,
          credentialsEncrypted: true,
          updatedAt: true,
        },
      }),
      this.prisma.fiscalAddonOffer.findUnique({ where: { id: ADDON_OFFER_ID } }),
      this.prisma.tenantFiscalAddonRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 100,
        include: { tenant: { select: { id: true, name: true, slug: true } } },
      }),
      this.prisma.fiscalAddonSubscription.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 100,
        include: {
          tenant: { select: { id: true, name: true, slug: true } },
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 5,
            select: {
              id: true,
              amount: true,
              currency: true,
              status: true,
              isTestMode: true,
              paidAt: true,
              createdAt: true,
            },
          },
        },
      }),
    ]);

    return {
      providers: providers.map(({ credentialsEncrypted, ...provider }) => ({
        ...provider,
        credentialsConfigured: Boolean(credentialsEncrypted),
      })),
      addonOffer: this.toPublicOffer(offer),
      addonRequests: requests,
      addonSubscriptions: subscriptions.map((subscription) => ({
        ...subscription,
        amount: subscription.amount.toString(),
        invoices: subscription.invoices.map((invoice) => ({
          ...invoice,
          amount: invoice.amount.toString(),
        })),
      })),
      testBillingEnabled: this.fiscalSimulator.isTestBillingEnabled(),
      fiscalTransactionsEnabled: false as const,
      taxCalculationEnabled: false as const,
      fiscalReceiptIssuanceEnabled: false as const,
    };
  }

  async configureProvider(
    jurisdiction: FiscalJurisdiction,
    input: FiscalProviderConfigurationRequest,
    actorPlatformAdminId: string,
  ) {
    if (input.credentials && input.clearCredentials) {
      throw new BadRequestException('Provide credentials or clear stored credentials, not both.');
    }
    if (
      input.approvalStatus === 'AUTHORITY_APPROVED' &&
      !input.approvalEvidenceReference?.trim()
    ) {
      throw new BadRequestException('An approval evidence reference is required for approved status.');
    }
    if (
      input.isAvailable &&
      (input.approvalStatus !== 'AUTHORITY_APPROVED' || !input.productionEndpoint)
    ) {
      throw new BadRequestException(
        'A provider can be made available only with authority approval evidence and a production endpoint.',
      );
    }

    const existing = await this.prisma.fiscalProviderConfiguration.findUnique({
      where: { jurisdiction },
    });
    const credentialsEncrypted = input.clearCredentials
      ? null
      : input.credentials
        ? encryptFiscalCredentials(input.credentials)
        : existing?.credentialsEncrypted ?? null;

    const record = await this.prisma.fiscalProviderConfiguration.upsert({
      where: { jurisdiction },
      create: {
        jurisdiction,
        providerName: input.providerName,
        productionEndpoint: input.productionEndpoint,
        sandboxEndpoint: input.sandboxEndpoint,
        documentationUrl: input.documentationUrl,
        approvalStatus: input.approvalStatus,
        approvalEvidenceReference: input.approvalEvidenceReference?.trim() || null,
        isAvailable: input.isAvailable,
        credentialsEncrypted,
      },
      update: {
        providerName: input.providerName,
        productionEndpoint: input.productionEndpoint,
        sandboxEndpoint: input.sandboxEndpoint,
        documentationUrl: input.documentationUrl,
        approvalStatus: input.approvalStatus,
        approvalEvidenceReference: input.approvalEvidenceReference?.trim() || null,
        isAvailable: input.isAvailable,
        credentialsEncrypted,
      },
    });

    const previousConfiguration = {
      providerName: existing?.providerName ?? null,
      productionEndpoint: existing?.productionEndpoint ?? null,
      sandboxEndpoint: existing?.sandboxEndpoint ?? null,
      documentationUrl: existing?.documentationUrl ?? null,
      approvalStatus: existing?.approvalStatus ?? null,
      approvalEvidenceReference: existing?.approvalEvidenceReference ?? null,
      isAvailable: existing?.isAvailable ?? false,
    };
    const nextConfiguration = {
      providerName: input.providerName,
      productionEndpoint: input.productionEndpoint,
      sandboxEndpoint: input.sandboxEndpoint,
      documentationUrl: input.documentationUrl,
      approvalStatus: input.approvalStatus,
      approvalEvidenceReference: input.approvalEvidenceReference?.trim() || null,
      isAvailable: input.isAvailable,
    };
    await this.prisma.platformAuditLog.create({
      data: {
        actorPlatformAdminId,
        action: existing ? 'fiscal_provider.updated' : 'fiscal_provider.created',
        resource: 'fiscal_provider_configuration',
        resourceId: record.id,
        metadata: {
          jurisdiction,
          changedFields: [
            ...(previousConfiguration.providerName !== nextConfiguration.providerName ? ['providerName'] : []),
            ...(previousConfiguration.productionEndpoint !== nextConfiguration.productionEndpoint ? ['productionEndpoint'] : []),
            ...(previousConfiguration.sandboxEndpoint !== nextConfiguration.sandboxEndpoint ? ['sandboxEndpoint'] : []),
            ...(previousConfiguration.documentationUrl !== nextConfiguration.documentationUrl ? ['documentationUrl'] : []),
            ...(previousConfiguration.approvalStatus !== nextConfiguration.approvalStatus ? ['approvalStatus'] : []),
            ...(previousConfiguration.approvalEvidenceReference !== nextConfiguration.approvalEvidenceReference
              ? ['approvalEvidenceReference']
              : []),
            ...(previousConfiguration.isAvailable !== nextConfiguration.isAvailable ? ['isAvailable'] : []),
          ],
          approvalStatus: record.approvalStatus,
          isAvailable: record.isAvailable,
          credentialsConfigured: Boolean(record.credentialsEncrypted),
          credentialsAction: input.clearCredentials
            ? 'cleared'
            : input.credentials
              ? 'updated'
              : 'unchanged',
        },
      },
    });
    return this.toPublicProvider(record);
  }

  async configureAddonOffer(input: FiscalAddonOfferRequest, actorPlatformAdminId: string) {
    if (!this.fiscalSimulator.isTestBillingEnabled()) {
      throw new ServiceUnavailableException(
        'Only test-only fiscal add-on offers can be configured; explicitly enable test billing in development or test.',
      );
    }
    if (
      input.isAvailable &&
      ![input.monthlyPrice, input.annualPrice].some((price) => price !== null)
    ) {
      throw new BadRequestException('At least one add-on price is required before publishing the offer.');
    }
    const existing = await this.prisma.fiscalAddonOffer.findUnique({
      where: { id: ADDON_OFFER_ID },
    });
    const offer = await this.prisma.fiscalAddonOffer.upsert({
      where: { id: ADDON_OFFER_ID },
      create: {
        id: ADDON_OFFER_ID,
        isAvailable: input.isAvailable,
        isTestOnly: true,
        currency: 'TZS',
        monthlyPrice: input.monthlyPrice,
        annualPrice: input.annualPrice,
      },
      update: {
        isAvailable: input.isAvailable,
        isTestOnly: true,
        currency: 'TZS',
        monthlyPrice: input.monthlyPrice,
        annualPrice: input.annualPrice,
      },
    });

    await this.prisma.platformAuditLog.create({
      data: {
        actorPlatformAdminId,
        action: existing ? 'fiscal_addon_offer.updated' : 'fiscal_addon_offer.created',
        resource: 'fiscal_addon_offer',
        resourceId: offer.id,
        metadata: {
          before: existing
            ? {
                isAvailable: existing.isAvailable,
                monthlyPrice: existing.monthlyPrice?.toString() ?? null,
                annualPrice: existing.annualPrice?.toString() ?? null,
              }
            : null,
          after: {
            isAvailable: offer.isAvailable,
            monthlyPrice: offer.monthlyPrice?.toString() ?? null,
            annualPrice: offer.annualPrice?.toString() ?? null,
          },
          isAvailable: offer.isAvailable,
          currency: offer.currency,
          monthlyPrice: offer.monthlyPrice?.toString() ?? null,
          annualPrice: offer.annualPrice?.toString() ?? null,
        },
      },
    });
    return this.toPublicOffer(offer);
  }

  async updateAddonRequest(
    requestId: string,
    input: FiscalAddonRequestUpdate,
    actorPlatformAdminId: string,
  ) {
    const existing = await this.prisma.tenantFiscalAddonRequest.findUnique({
      where: { id: requestId },
    });
    if (!existing) {
      throw new NotFoundException('Fiscal add-on request was not found.');
    }
    const request = await this.prisma.tenantFiscalAddonRequest.update({
      where: { id: requestId },
      data: {
        status: input.status,
        message: input.message?.trim() || null,
      },
      include: { tenant: { select: { id: true, name: true, slug: true } } },
    });
    await this.prisma.platformAuditLog.create({
      data: {
        actorPlatformAdminId,
        action: 'fiscal_addon_request.updated',
        resource: 'tenant_fiscal_addon_request',
        resourceId: requestId,
        metadata: {
          tenantId: request.tenantId,
          jurisdiction: request.jurisdiction,
          beforeStatus: existing.status,
          status: request.status,
        },
      },
    });
    return request;
  }

  async getTenantConfiguration(tenantId: string) {
    const [providers, profiles, offer, requests] = await Promise.all([
      this.prisma.fiscalProviderConfiguration.findMany({
        where: { isAvailable: true, approvalStatus: 'AUTHORITY_APPROVED' },
        orderBy: { jurisdiction: 'asc' },
        select: {
          id: true,
          jurisdiction: true,
          providerName: true,
          productionEndpoint: true,
          sandboxEndpoint: true,
          documentationUrl: true,
          approvalStatus: true,
          isAvailable: true,
        },
      }),
      this.prisma.tenantFiscalProfile.findMany({
        where: { tenantId },
        orderBy: { jurisdiction: 'asc' },
        select: {
          id: true,
          jurisdiction: true,
          providerConfigurationId: true,
          legalName: true,
          taxIdentificationNumber: true,
          vatRegistrationNumber: true,
          credentialsEncrypted: true,
          updatedAt: true,
        },
      }),
      this.prisma.fiscalAddonOffer.findUnique({ where: { id: ADDON_OFFER_ID } }),
      this.prisma.tenantFiscalAddonRequest.findMany({
        where: { tenantId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          jurisdiction: true,
          status: true,
          message: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
    ]);

    return {
      providers,
      profiles: profiles.map(({ credentialsEncrypted, ...profile }) => ({
        ...profile,
        credentialsConfigured: Boolean(credentialsEncrypted),
      })),
      addonOffer: this.fiscalSimulator.isTestBillingEnabled() && offer?.isAvailable && offer.isTestOnly
        ? this.toPublicOffer(offer)
        : {
            id: 'fiscalization',
            isAvailable: false,
            isTestOnly: true,
            currency: 'TZS',
            monthlyPrice: null,
            annualPrice: null,
          },
      testBillingEnabled: this.fiscalSimulator.isTestBillingEnabled(),
      addonRequests: requests,
      fiscalTransactionsEnabled: false as const,
      taxCalculationEnabled: false as const,
      fiscalReceiptIssuanceEnabled: false as const,
      simulator: {
        enabled: this.fiscalSimulator.isEnabled(),
        mode: 'SIMULATED_ONLY' as const,
      },
    };
  }

  simulate(input: FiscalSimulationRequest) {
    return this.fiscalSimulator.simulate(input);
  }

  async updateTenantProfile(
    actor: AuthenticatedUser,
    jurisdiction: FiscalJurisdiction,
    input: TenantFiscalProfileRequest,
  ) {
    if (input.credentials && input.clearCredentials) {
      throw new BadRequestException('Provide credentials or clear stored credentials, not both.');
    }

    if (input.providerConfigurationId) {
      const provider = await this.prisma.fiscalProviderConfiguration.findFirst({
        where: {
          id: input.providerConfigurationId,
          jurisdiction,
          isAvailable: true,
          approvalStatus: 'AUTHORITY_APPROVED',
        },
        select: { id: true },
      });
      if (!provider) {
        throw new BadRequestException('The selected provider is not approved and available for this jurisdiction.');
      }
    }

    const existing = await this.prisma.tenantFiscalProfile.findUnique({
      where: { tenantId_jurisdiction: { tenantId: actor.tenantId, jurisdiction } },
    });
    const credentialsEncrypted = input.clearCredentials
      ? null
      : input.credentials
        ? encryptFiscalCredentials(input.credentials)
        : existing?.credentialsEncrypted ?? null;
    const profile = await this.prisma.tenantFiscalProfile.upsert({
      where: { tenantId_jurisdiction: { tenantId: actor.tenantId, jurisdiction } },
      create: {
        tenantId: actor.tenantId,
        jurisdiction,
        providerConfigurationId: input.providerConfigurationId,
        legalName: input.legalName?.trim() || null,
        taxIdentificationNumber: input.taxIdentificationNumber?.trim() || null,
        vatRegistrationNumber: input.vatRegistrationNumber?.trim() || null,
        credentialsEncrypted,
      },
      update: {
        providerConfigurationId: input.providerConfigurationId,
        legalName: input.legalName?.trim() || null,
        taxIdentificationNumber: input.taxIdentificationNumber?.trim() || null,
        vatRegistrationNumber: input.vatRegistrationNumber?.trim() || null,
        credentialsEncrypted,
      },
      select: {
        id: true,
        jurisdiction: true,
        providerConfigurationId: true,
        legalName: true,
        taxIdentificationNumber: true,
        vatRegistrationNumber: true,
        credentialsEncrypted: true,
        updatedAt: true,
      },
    });
    await this.prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.id,
        action: 'fiscal_profile.updated',
        resource: 'tenant_fiscal_profile',
        resourceId: profile.id,
        metadata: {
          jurisdiction,
          changedFields: [
            ...(existing?.legalName !== (input.legalName?.trim() || null) ? ['legalName'] : []),
            ...(existing?.taxIdentificationNumber !== (input.taxIdentificationNumber?.trim() || null)
              ? ['taxIdentificationNumber']
              : []),
            ...(existing?.vatRegistrationNumber !== (input.vatRegistrationNumber?.trim() || null)
              ? ['vatRegistrationNumber']
              : []),
            ...(existing?.providerConfigurationId !== input.providerConfigurationId
              ? ['providerConfigurationId']
              : []),
          ],
          providerConfigurationId: profile.providerConfigurationId,
          taxIdentifiersConfigured: Boolean(profile.taxIdentificationNumber || profile.vatRegistrationNumber),
          credentialsConfigured: Boolean(profile.credentialsEncrypted),
          credentialsAction: input.clearCredentials
            ? 'cleared'
            : input.credentials
              ? 'updated'
              : 'unchanged',
        } as Prisma.InputJsonObject,
      },
    });

    const { credentialsEncrypted: storedCredentials, ...safeProfile } = profile;
    return { ...safeProfile, credentialsConfigured: Boolean(storedCredentials) };
  }

  async createAddonRequest(actor: AuthenticatedUser, input: TenantFiscalAddonRequestCreate) {
    const [offer, provider] = await Promise.all([
      this.prisma.fiscalAddonOffer.findUnique({ where: { id: ADDON_OFFER_ID } }),
      this.prisma.fiscalProviderConfiguration.findFirst({
        where: {
          jurisdiction: input.jurisdiction,
          isAvailable: true,
          approvalStatus: 'AUTHORITY_APPROVED',
        },
        select: { id: true },
      }),
    ]);
    if (!offer?.isAvailable) {
      throw new BadRequestException('The fiscalization add-on is not currently offered.');
    }
    if (!provider) {
      throw new BadRequestException('No approved provider is available for this jurisdiction.');
    }
    const existing = await this.prisma.tenantFiscalAddonRequest.findFirst({
      where: { tenantId: actor.tenantId, jurisdiction: input.jurisdiction, status: 'PENDING' },
      select: { id: true },
    });
    if (existing) {
      throw new ConflictException('A request for this jurisdiction is already pending.');
    }
    let request;
    try {
      request = await this.prisma.tenantFiscalAddonRequest.create({
        data: {
          tenantId: actor.tenantId,
          jurisdiction: input.jurisdiction,
          message: input.message?.trim() || null,
        },
        select: {
          id: true,
          jurisdiction: true,
          status: true,
          message: true,
          createdAt: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('A request for this jurisdiction is already pending.');
      }
      throw error;
    }
    await this.prisma.auditLog.create({
      data: {
        tenantId: actor.tenantId,
        actorMembershipId: actor.membershipId,
        actorUserId: actor.id,
        action: 'fiscal_addon.requested',
        resource: 'tenant_fiscal_addon_request',
        resourceId: request.id,
        metadata: { jurisdiction: request.jurisdiction },
      },
    });
    return {
      ...request,
      message: 'Request received. This is not an active subscription; no fiscal processing or charge has been started.',
    };
  }

  private toPublicOffer(offer: {
    id: string;
    isAvailable: boolean;
    isTestOnly: boolean;
    currency: string;
    monthlyPrice: Prisma.Decimal | null;
    annualPrice: Prisma.Decimal | null;
  } | null) {
    if (!offer) {
      return {
        id: ADDON_OFFER_ID,
        isAvailable: false,
        isTestOnly: true,
        currency: 'TZS',
        monthlyPrice: null,
        annualPrice: null,
      };
    }
    return {
      id: offer.id,
      isAvailable: offer.isAvailable,
      isTestOnly: offer.isTestOnly,
      currency: offer.currency,
      monthlyPrice: offer.monthlyPrice?.toString() ?? null,
      annualPrice: offer.annualPrice?.toString() ?? null,
    };
  }

  private toPublicProvider(provider: {
    id: string;
    jurisdiction: FiscalJurisdiction;
    providerName: string;
    productionEndpoint: string | null;
    sandboxEndpoint: string | null;
    documentationUrl: string | null;
    approvalStatus: 'UNVERIFIED' | 'SANDBOX_VALIDATED' | 'AUTHORITY_APPROVED';
    approvalEvidenceReference: string | null;
    isAvailable: boolean;
    credentialsEncrypted: string | null;
    updatedAt: Date;
  }) {
    const { credentialsEncrypted, ...safeProvider } = provider;
    return { ...safeProvider, credentialsConfigured: Boolean(credentialsEncrypted) };
  }
}
