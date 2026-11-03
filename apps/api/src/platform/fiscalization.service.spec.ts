import { BadRequestException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service';
import { AuthenticatedUser } from '../auth/auth.types';
import { FiscalizationService } from './fiscalization.service';
import { FiscalSimulatorService } from './fiscal-simulator.service';

describe('FiscalizationService', () => {
  const previousKey = process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY;
  const prisma = {
    fiscalProviderConfiguration: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      upsert: jest.fn(),
    },
    fiscalAddonOffer: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    tenantFiscalProfile: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
    tenantFiscalAddonRequest: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    platformAuditLog: { create: jest.fn() },
    auditLog: { create: jest.fn() },
  };
  let service: FiscalizationService;
  const simulator = {
    isEnabled: jest.fn().mockReturnValue(false),
    isTestBillingEnabled: jest.fn().mockReturnValue(false),
    simulate: jest.fn(),
  };

  const actor: AuthenticatedUser = {
    id: 'user-1',
    tenantId: 'tenant-1',
    membershipId: 'membership-1',
    email: 'owner@example.test',
    role: 'Tenant Owner',
    roleNames: ['Tenant Owner'],
    permissions: ['fiscal_settings.view', 'fiscal_settings.update'],
    storeIds: [],
    allStoreAccess: true,
    tenantStatus: 'ACTIVE',
    mfaEnabled: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY = Buffer.alloc(32, 9).toString('base64');
    service = new FiscalizationService(
      prisma as unknown as PrismaService,
      simulator as unknown as FiscalSimulatorService,
    );
  });

  afterAll(() => {
    if (previousKey === undefined) {
      delete process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY;
    } else {
      process.env.FISCAL_CREDENTIAL_ENCRYPTION_KEY = previousKey;
    }
  });

  it('does not make unapproved providers available', async () => {
    await expect(service.configureProvider(
      'MAINLAND_TANZANIA',
      {
        providerName: 'Unapproved provider',
        productionEndpoint: 'https://provider.example.test',
        sandboxEndpoint: null,
        documentationUrl: null,
        approvalStatus: 'UNVERIFIED',
        approvalEvidenceReference: null,
        isAvailable: true,
      },
      'admin-1',
    )).rejects.toThrow(BadRequestException);
    expect(prisma.fiscalProviderConfiguration.upsert).not.toHaveBeenCalled();
  });

  it('stores provider credentials encrypted and excludes them from response and audit', async () => {
    prisma.fiscalProviderConfiguration.findUnique.mockResolvedValue(null);
    prisma.fiscalProviderConfiguration.upsert.mockImplementation(async ({ create }) => ({
      id: 'provider-1',
      jurisdiction: 'MAINLAND_TANZANIA',
      providerName: create.providerName,
      productionEndpoint: create.productionEndpoint,
      sandboxEndpoint: create.sandboxEndpoint,
      documentationUrl: create.documentationUrl,
      approvalStatus: create.approvalStatus,
      approvalEvidenceReference: create.approvalEvidenceReference,
      isAvailable: create.isAvailable,
      credentialsEncrypted: create.credentialsEncrypted,
      updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    }));
    prisma.platformAuditLog.create.mockResolvedValue({});

    const result = await service.configureProvider(
      'MAINLAND_TANZANIA',
      {
        providerName: 'Approved provider',
        productionEndpoint: 'https://provider.example.test',
        sandboxEndpoint: 'https://sandbox.example.test',
        documentationUrl: 'https://docs.example.test',
        approvalStatus: 'AUTHORITY_APPROVED',
        approvalEvidenceReference: 'approval-123',
        isAvailable: true,
        credentials: { token: 'never-return-this' },
      },
      'admin-1',
    );

    const saved = prisma.fiscalProviderConfiguration.upsert.mock.calls[0][0].create;
    expect(saved.credentialsEncrypted).not.toContain('never-return-this');
    expect(result).not.toHaveProperty('credentialsEncrypted');
    expect(result).not.toHaveProperty('credentials');
    expect(result.credentialsConfigured).toBe(true);
    expect(JSON.stringify(prisma.platformAuditLog.create.mock.calls[0][0])).not.toContain('never-return-this');
  });

  it('keeps tenant fiscal capability disabled in responses and scopes profile reads to the tenant', async () => {
    prisma.fiscalProviderConfiguration.findMany.mockResolvedValue([]);
    prisma.tenantFiscalProfile.findMany.mockResolvedValue([]);
    prisma.fiscalAddonOffer.findUnique.mockResolvedValue({
      id: 'fiscalization',
      isAvailable: false,
      isTestOnly: true,
      currency: 'TZS',
      monthlyPrice: { toString: () => '25000.00' },
      annualPrice: null,
    });
    prisma.tenantFiscalAddonRequest.findMany.mockResolvedValue([]);

    const result = await service.getTenantConfiguration(actor.tenantId);

    expect(prisma.tenantFiscalProfile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { tenantId: actor.tenantId } }),
    );
    expect(result).toMatchObject({
      addonOffer: { isAvailable: false, monthlyPrice: null, annualPrice: null },
      testBillingEnabled: false,
      fiscalTransactionsEnabled: false,
      taxCalculationEnabled: false,
      fiscalReceiptIssuanceEnabled: false,
    });
  });

  it('does not publish an add-on offer without a configured price', async () => {
    simulator.isTestBillingEnabled.mockReturnValue(true);
    await expect(service.configureAddonOffer(
      { isAvailable: true, monthlyPrice: null, annualPrice: null },
      'admin-1',
    )).rejects.toThrow(BadRequestException);
    expect(prisma.fiscalAddonOffer.upsert).not.toHaveBeenCalled();
  });
});
