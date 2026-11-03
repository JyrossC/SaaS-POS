import { SchemaObject } from '@nestjs/swagger';

const objectSchema = (
  properties: Record<string, SchemaObject>,
  required = Object.keys(properties),
): SchemaObject => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const stringField = (): SchemaObject => ({ type: 'string' });

export const authenticatedUserResponseSchema = objectSchema({
  id: stringField(),
  membershipId: stringField(),
  tenantId: stringField(),
  tenantStatus: { type: 'string', enum: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED'] },
  email: { type: 'string', format: 'email' },
  mfaEnabled: { type: 'boolean' },
  role: stringField(),
  roleNames: { type: 'array', items: stringField() },
  permissions: { type: 'array', items: stringField() },
  storeIds: { type: 'array', items: stringField() },
  allStoreAccess: { type: 'boolean' },
});

export const authenticationResponseSchema = objectSchema({
  accessToken: stringField(),
  user: authenticatedUserResponseSchema,
});

export const tenantRegistrationResponseSchema = objectSchema({
  status: { type: 'string', enum: ['PENDING_REVIEW'] },
  message: stringField(),
});

export const businessSettingsResponseSchema = objectSchema({
  id: stringField(),
  name: stringField(),
  businessType: { type: 'string', enum: ['RETAIL', 'PHARMACY', 'HYBRID'] },
  businessAddress: { type: 'string', nullable: true },
  contactEmail: { type: 'string', format: 'email', nullable: true },
  contactPhone: { type: 'string', nullable: true },
  currency: { type: 'string', enum: ['TZS'] },
  timezone: { type: 'string', enum: ['Africa/Dar_es_Salaam'] },
  taxEnabled: { type: 'boolean', enum: [false] },
  taxStatus: { type: 'string', enum: ['DISABLED_PENDING_REVIEW'] },
  receiptSettingsStatus: { type: 'string', enum: ['PENDING_LEGAL_REVIEW'] },
  notificationSettingsStatus: { type: 'string', enum: ['NOT_CONFIGURED'] },
  integrationsStatus: { type: 'string', enum: ['NOT_CONFIGURED'] },
});

const fiscalProviderResponseSchema = objectSchema({
  id: stringField(),
  jurisdiction: { type: 'string', enum: ['MAINLAND_TANZANIA', 'ZANZIBAR'] },
  providerName: stringField(),
  productionEndpoint: { type: 'string', nullable: true },
  sandboxEndpoint: { type: 'string', nullable: true },
  documentationUrl: { type: 'string', nullable: true },
  approvalStatus: { type: 'string', enum: ['UNVERIFIED', 'SANDBOX_VALIDATED', 'AUTHORITY_APPROVED'] },
  approvalEvidenceReference: { type: 'string', nullable: true },
  isAvailable: { type: 'boolean' },
  credentialsConfigured: { type: 'boolean' },
  updatedAt: { type: 'string', format: 'date-time' },
});

export const fiscalAddonOfferResponseSchema = objectSchema({
  id: stringField(),
  isAvailable: { type: 'boolean' },
  isTestOnly: { type: 'boolean', enum: [true] },
  currency: { type: 'string', enum: ['TZS'] },
  monthlyPrice: { type: 'string', nullable: true },
  annualPrice: { type: 'string', nullable: true },
}, ['isAvailable', 'currency', 'monthlyPrice', 'annualPrice']);

const fiscalAddonRequestResponseSchema = objectSchema({
  id: stringField(),
  tenantId: stringField(),
  jurisdiction: { type: 'string', enum: ['MAINLAND_TANZANIA', 'ZANZIBAR'] },
  status: { type: 'string', enum: ['PENDING', 'CONTACTED', 'CLOSED'] },
  message: { type: 'string', nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
  tenant: objectSchema({
    id: stringField(),
    name: stringField(),
    slug: stringField(),
  }),
});

const fiscalProfileResponseSchema = objectSchema({
  id: stringField(),
  jurisdiction: { type: 'string', enum: ['MAINLAND_TANZANIA', 'ZANZIBAR'] },
  providerConfigurationId: { type: 'string', nullable: true },
  legalName: { type: 'string', nullable: true },
  taxIdentificationNumber: { type: 'string', nullable: true },
  vatRegistrationNumber: { type: 'string', nullable: true },
  credentialsConfigured: { type: 'boolean' },
  updatedAt: { type: 'string', format: 'date-time' },
});

const fiscalizationCapabilitiesSchema = {
  fiscalTransactionsEnabled: { type: 'boolean', enum: [false] },
  taxCalculationEnabled: { type: 'boolean', enum: [false] },
  fiscalReceiptIssuanceEnabled: { type: 'boolean', enum: [false] },
} satisfies Record<string, SchemaObject>;

export const platformFiscalizationResponseSchema = objectSchema({
  providers: { type: 'array', items: fiscalProviderResponseSchema },
  addonOffer: fiscalAddonOfferResponseSchema,
  addonRequests: { type: 'array', items: fiscalAddonRequestResponseSchema },
  addonSubscriptions: {
    type: 'array',
    items: objectSchema({
      id: stringField(),
      tenantId: stringField(),
      jurisdiction: { type: 'string', enum: ['MAINLAND_TANZANIA', 'ZANZIBAR'] },
      billingPeriod: { type: 'string', enum: ['MONTHLY', 'ANNUAL'] },
      status: { type: 'string', enum: ['PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] },
      amount: stringField(),
      currency: { type: 'string', enum: ['TZS'] },
      isTestMode: { type: 'boolean', enum: [true] },
      cancelAtPeriodEnd: { type: 'boolean' },
      tenant: objectSchema({ id: stringField(), name: stringField(), slug: stringField() }),
    }),
  },
  testBillingEnabled: { type: 'boolean' },
  ...fiscalizationCapabilitiesSchema,
});

export const tenantFiscalizationResponseSchema = objectSchema({
  providers: {
    type: 'array',
    items: objectSchema({
      id: stringField(),
      jurisdiction: { type: 'string', enum: ['MAINLAND_TANZANIA', 'ZANZIBAR'] },
      providerName: stringField(),
      productionEndpoint: { type: 'string', nullable: true },
      sandboxEndpoint: { type: 'string', nullable: true },
      documentationUrl: { type: 'string', nullable: true },
      approvalStatus: { type: 'string', enum: ['AUTHORITY_APPROVED'] },
      isAvailable: { type: 'boolean', enum: [true] },
    }),
  },
  profiles: { type: 'array', items: fiscalProfileResponseSchema },
  addonOffer: fiscalAddonOfferResponseSchema,
  testBillingEnabled: { type: 'boolean' },
  addonRequests: {
    type: 'array',
    items: objectSchema({
      id: stringField(),
      jurisdiction: { type: 'string', enum: ['MAINLAND_TANZANIA', 'ZANZIBAR'] },
      status: { type: 'string', enum: ['PENDING', 'CONTACTED', 'CLOSED'] },
      message: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
      updatedAt: { type: 'string', format: 'date-time' },
    }),
  },
  simulator: objectSchema({
    enabled: { type: 'boolean' },
    mode: { type: 'string', enum: ['SIMULATED_ONLY'] },
  }),
  ...fiscalizationCapabilitiesSchema,
});

export const fiscalAddonSubscriptionsResponseSchema = {
  type: 'array',
  items: objectSchema({
    id: stringField(),
    jurisdiction: { type: 'string', enum: ['MAINLAND_TANZANIA', 'ZANZIBAR'] },
    billingPeriod: { type: 'string', enum: ['MONTHLY', 'ANNUAL'] },
    status: { type: 'string', enum: ['PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] },
    amount: stringField(),
    currency: { type: 'string', enum: ['TZS'] },
    isTestMode: { type: 'boolean', enum: [true] },
    currentPeriodStartsAt: { type: 'string', format: 'date-time', nullable: true },
    currentPeriodEndsAt: { type: 'string', format: 'date-time', nullable: true },
    cancelAtPeriodEnd: { type: 'boolean' },
    invoices: {
      type: 'array',
      items: objectSchema({
        id: stringField(),
        amount: stringField(),
        currency: stringField(),
        status: { type: 'string', enum: ['DRAFT', 'PENDING_PAYMENT', 'PAID', 'FAILED', 'VOIDED'] },
        isTestMode: { type: 'boolean', enum: [true] },
        paidAt: { type: 'string', format: 'date-time', nullable: true },
        createdAt: { type: 'string', format: 'date-time' },
        payments: {
          type: 'array',
          items: objectSchema({
            id: stringField(),
            providerReference: { type: 'string', nullable: true },
            status: { type: 'string', enum: ['PENDING', 'PAID', 'FAILED', 'CANCELED'] },
            amount: stringField(),
            currency: stringField(),
            isTestMode: { type: 'boolean', enum: [true] },
            createdAt: { type: 'string', format: 'date-time' },
          }),
        },
      }),
    },
  }),
};

export const fiscalAddonCheckoutResponseSchema = objectSchema({
  id: stringField(),
  tenantId: stringField(),
  fiscalAddonSubscriptionId: stringField(),
  amount: stringField(),
  currency: { type: 'string', enum: ['TZS'] },
  status: { type: 'string', enum: ['DRAFT', 'PENDING_PAYMENT', 'PAID', 'FAILED', 'VOIDED'] },
  isTestMode: { type: 'boolean', enum: [true] },
  fiscalBillingPeriod: { type: 'string', enum: ['MONTHLY', 'ANNUAL'] },
  fiscalPeriodStartsAt: { type: 'string', format: 'date-time' },
  fiscalPeriodEndsAt: { type: 'string', format: 'date-time' },
  createdAt: { type: 'string', format: 'date-time' },
});

export const fiscalAddonPaymentSimulationResponseSchema = objectSchema({
  idempotent: { type: 'boolean' },
  simulationOnly: { type: 'boolean', enum: [true] },
  realChargeMade: { type: 'boolean', enum: [false] },
  subscriptionStatus: { type: 'string', enum: ['PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'CANCELED'] },
  payment: objectSchema({
    id: stringField(),
    invoiceId: stringField(),
    providerReference: stringField(),
    status: { type: 'string', enum: ['PENDING', 'PAID', 'FAILED', 'CANCELED'] },
    amount: stringField(),
    currency: stringField(),
    isTestMode: { type: 'boolean', enum: [true] },
    createdAt: { type: 'string', format: 'date-time' },
  }),
  invoice: fiscalAddonCheckoutResponseSchema,
});

export const fiscalAddonSubscriptionActionResponseSchema = objectSchema({
  canceled: { type: 'boolean' },
  cancellationAtPeriodEnd: { type: 'boolean' },
  id: stringField(),
  status: { type: 'string', enum: ['PENDING_PAYMENT', 'ACTIVE', 'PAST_DUE', 'CANCELED', 'EXPIRED'] },
  cancelAtPeriodEnd: { type: 'boolean' },
});

export const fiscalSimulationResponseSchema = objectSchema({
  simulationOnly: { type: 'boolean', enum: [true] },
  officialReceiptIssued: { type: 'boolean', enum: [false] },
  salesRecordCreated: { type: 'boolean', enum: [false] },
  taxCalculated: { type: 'boolean', enum: [false] },
  providerContacted: { type: 'boolean', enum: [false] },
  jurisdiction: { type: 'string', enum: ['MAINLAND_TANZANIA', 'ZANZIBAR'] },
  scenario: { type: 'string', enum: ['ACCEPTED', 'REJECTED', 'TIMEOUT', 'DUPLICATE', 'RECOVERED'] },
  outcome: {
    type: 'string',
    enum: [
      'SIMULATED_ACCEPTED',
      'SIMULATED_REJECTED',
      'SIMULATED_TIMEOUT',
      'SIMULATED_DUPLICATE',
      'SIMULATED_RECOVERED',
    ],
  },
  simulationId: stringField(),
  simulatedAt: { type: 'string', format: 'date-time' },
  message: stringField(),
});

export const fiscalProviderConfigurationResponseSchema = fiscalProviderResponseSchema;
export const fiscalAddonRequestUpdateResponseSchema = fiscalAddonRequestResponseSchema;

export const forgotPasswordResponseSchema = objectSchema({
  message: stringField(),
});

export const logoutResponseSchema = objectSchema({
  loggedOut: { type: 'boolean', enum: [true] },
});

export const emailVerificationResponseSchema = objectSchema({
  verified: { type: 'boolean', enum: [true] },
});

export const mfaSetupResponseSchema = objectSchema({
  secret: stringField(),
  provisioningUri: stringField(),
});

export const mfaRecoveryCodesResponseSchema = objectSchema({
  recoveryCodes: { type: 'array', items: stringField() },
});

export const mfaDisabledResponseSchema = objectSchema({
  disabled: { type: 'boolean', enum: [true] },
});

export const platformAdminResponseSchema = objectSchema({
  id: stringField(),
  email: { type: 'string', format: 'email' },
  name: stringField(),
});

export const platformAdminSessionResponseSchema = objectSchema(
  {
    accessToken: stringField(),
    platformAdmin: platformAdminResponseSchema,
    recoveryCodes: { type: 'array', items: stringField() },
  },
  ['accessToken', 'platformAdmin'],
);

export const platformLoginResponseSchema: SchemaObject = {
  oneOf: [
    objectSchema({
      mfaSetupRequired: { type: 'boolean', enum: [true] },
      setupToken: stringField(),
      platformAdmin: platformAdminResponseSchema,
    }),
    platformAdminSessionResponseSchema,
  ],
};

export const healthResponseSchema = objectSchema({
  status: { type: 'string', enum: ['ok', 'degraded'] },
  timestamp: { type: 'string', format: 'date-time' },
  database: { type: 'string', enum: ['connected', 'disconnected'] },
});
healthResponseSchema.oneOf = [
  {
    properties: {
      status: { type: 'string', enum: ['ok'] },
      database: { type: 'string', enum: ['connected'] },
    },
  },
  {
    properties: {
      status: { type: 'string', enum: ['degraded'] },
      database: { type: 'string', enum: ['disconnected'] },
    },
  },
];

export const aiQueryResponseSchema = objectSchema({
  query: stringField(),
  intent: {
    type: 'string',
    enum: [
      'sales_summary',
      'inventory_status',
      'top_products',
      'store_comparison',
      'low_stock_alert',
      'unknown',
    ],
  },
  data: { type: 'object', additionalProperties: true },
  summary: stringField(),
  generatedAt: { type: 'string', format: 'date-time' },
});

export const aiCapabilitiesResponseSchema = objectSchema({
  supportedQueries: {
    type: 'array',
    items: { type: 'string' },
  },
  description: stringField(),
  classificationMethod: { type: 'string', enum: ['rule-based keyword matching'] },
  providesForecasting: { type: 'boolean', enum: [false] },
  providesConfidenceScoring: { type: 'boolean', enum: [false] },
  providesReplenishmentRecommendations: { type: 'boolean', enum: [false] },
});

export const installationStatusResponseSchema = objectSchema({
  initialized: { type: 'boolean' },
});

export const installationResponseSchema = objectSchema({
  initialized: { type: 'boolean', enum: [true] },
  platformName: stringField(),
});

export const platformStatsResponseSchema = objectSchema({
  totalTenants: { type: 'integer' },
  activeTenants: { type: 'integer' },
  totalStores: { type: 'integer' },
  totalProducts: { type: 'integer' },
  totalSales: { type: 'integer' },
  totalRevenue: { type: 'number' },
});

const platformAdminRecordSchema = objectSchema({
  id: stringField(),
  email: { type: 'string', format: 'email' },
  name: stringField(),
  status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] },
  mfaEnabled: { type: 'boolean' },
  createdAt: { type: 'string', format: 'date-time' },
});

export const platformAdminListResponseSchema: SchemaObject = {
  type: 'array',
  items: platformAdminRecordSchema,
};

export const platformAdminInvitationResponseSchema = objectSchema({
  invited: { type: 'boolean', enum: [true] },
});

export const platformAdminInvitationAcceptanceResponseSchema = objectSchema({
  accepted: { type: 'boolean', enum: [true] },
  email: { type: 'string', format: 'email' },
});

export const platformAdminStatusResponseSchema = objectSchema({
  id: stringField(),
  status: { type: 'string', enum: ['ACTIVE', 'DISABLED'] },
});

const planEntitlementSchema = objectSchema({
  id: stringField(),
  planVersionId: stringField(),
  key: stringField(),
  value: {},
});

const platformPlanVersionSchema = objectSchema({
  id: stringField(),
  planId: stringField(),
  version: { type: 'integer' },
  isActive: { type: 'boolean' },
  trialDays: { type: 'integer' },
  billingPeriodDays: { type: 'integer' },
  currency: stringField(),
  price: { type: 'string', nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
  entitlements: { type: 'array', items: planEntitlementSchema },
  _count: objectSchema({ subscriptions: { type: 'integer' } }),
});

const platformPlanSchema = objectSchema({
  id: stringField(),
  code: stringField(),
  name: stringField(),
  isAvailable: { type: 'boolean' },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
  versions: { type: 'array', items: platformPlanVersionSchema },
});

export const platformPlanListResponseSchema: SchemaObject = {
  type: 'array',
  items: platformPlanSchema,
};

export const platformPlanResponseSchema = platformPlanSchema;

export const platformPlanVersionResponseSchema = objectSchema({
  id: stringField(),
  planId: stringField(),
  version: { type: 'integer' },
  isActive: { type: 'boolean' },
  trialDays: { type: 'integer' },
  billingPeriodDays: { type: 'integer' },
  currency: stringField(),
  price: { type: 'string', nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
  entitlements: { type: 'array', items: planEntitlementSchema },
});

export const platformPlanCreateResponseSchema = objectSchema({
  id: stringField(),
  code: stringField(),
  name: stringField(),
  isAvailable: { type: 'boolean' },
  createdAt: { type: 'string', format: 'date-time' },
  updatedAt: { type: 'string', format: 'date-time' },
  versions: { type: 'array', items: platformPlanVersionResponseSchema },
});

export const platformPlanAvailabilityResponseSchema = objectSchema({
  id: stringField(),
  isAvailable: { type: 'boolean' },
});

export const platformTenantPlanResponseSchema = objectSchema({
  id: stringField(),
  status: { type: 'string', enum: ['PENDING_PAYMENT', 'TRIALING', 'ACTIVE'] },
  startsAt: { type: 'string', format: 'date-time' },
  endsAt: { type: 'string', format: 'date-time', nullable: true },
  trialEndsAt: { type: 'string', format: 'date-time', nullable: true },
  plan: objectSchema({
    code: stringField(),
    name: stringField(),
    version: { type: 'integer' },
  }),
});

export const platformTenantStatusResponseSchema = objectSchema({
  id: stringField(),
  status: { type: 'string', enum: ['ACTIVE', 'SUSPENDED'] },
});

const supportScopesSchema: SchemaObject = {
  type: 'array',
  items: { type: 'string', enum: ['tenant_profile', 'stores', 'products', 'sales_summary'] },
};

const platformSupportAccessSchema = objectSchema({
  id: stringField(),
  tenant: objectSchema({
    id: stringField(),
    name: stringField(),
    slug: stringField(),
  }),
  purpose: stringField(),
  scopes: supportScopesSchema,
  expiresAt: { type: 'string', format: 'date-time' },
  createdAt: { type: 'string', format: 'date-time' },
  revokedAt: { type: 'string', format: 'date-time', nullable: true },
  status: { type: 'string', enum: ['ACTIVE', 'REVOKED', 'EXPIRED'] },
  events: {
    type: 'array',
    items: objectSchema({
      id: stringField(),
      supportAccessId: stringField(),
      actorPlatformAdminId: stringField(),
      action: stringField(),
      scope: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    }),
  },
});

export const platformSupportAccessListResponseSchema: SchemaObject = {
  type: 'array',
  items: platformSupportAccessSchema,
};

export const platformSupportAccessGrantResponseSchema = objectSchema({
  id: stringField(),
  tenantId: stringField(),
  tenantName: stringField(),
  purpose: stringField(),
  scopes: supportScopesSchema,
  expiresAt: { type: 'string', format: 'date-time' },
  createdAt: { type: 'string', format: 'date-time' },
  revokedAt: { type: 'string', format: 'date-time', nullable: true },
});

export const platformSupportAccessRevokeResponseSchema = objectSchema({
  id: stringField(),
  revokedAt: { type: 'string', format: 'date-time' },
});

export const platformSupportTenantResponseSchema = objectSchema({
  id: stringField(),
  name: stringField(),
  slug: stringField(),
  businessType: { type: 'string', enum: ['RETAIL', 'PHARMACY', 'HYBRID'] },
  status: { type: 'string', enum: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED'] },
  createdAt: { type: 'string', format: 'date-time' },
});

export const platformSupportStoresResponseSchema: SchemaObject = {
  type: 'array',
  items: objectSchema({
    id: stringField(),
    name: stringField(),
    code: stringField(),
    status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
    location: { type: 'string', nullable: true },
  }),
};

export const platformSupportProductsResponseSchema = objectSchema({
  items: {
    type: 'array',
    items: objectSchema({
      id: stringField(),
      sku: stringField(),
      name: stringField(),
      baseUnit: stringField(),
      sellingPrice: stringField(),
      isActive: { type: 'boolean' },
    }),
  },
  total: { type: 'integer' },
  limit: { type: 'integer' },
});

export const platformSupportSalesSummaryResponseSchema = objectSchema({
  allTime: objectSchema({
    completedSales: { type: 'integer' },
    grossTotal: stringField(),
  }),
  last30Days: objectSchema({
    completedSales: { type: 'integer' },
    grossTotal: stringField(),
  }),
  includesCustomerDetails: { type: 'boolean', enum: [false] },
});

const platformTenantItemSchema = objectSchema({
  id: stringField(),
  slug: stringField(),
  name: stringField(),
  businessType: { type: 'string', enum: ['RETAIL', 'PHARMACY', 'HYBRID'] },
  status: { type: 'string', enum: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED'] },
  createdAt: { type: 'string', format: 'date-time' },
  memberships: {
    type: 'array',
    items: objectSchema({
      status: stringField(),
      user: objectSchema({
        name: { type: 'string', nullable: true },
        email: { type: 'string', format: 'email' },
      }),
    }),
  },
  subscription: {
    ...objectSchema({
      status: stringField(),
      planVersion: objectSchema({
        version: { type: 'integer' },
        plan: objectSchema({ code: stringField(), name: stringField() }),
      }),
    }),
    nullable: true,
  },
  kybDocuments: {
    type: 'array',
    items: objectSchema({
      id: stringField(),
      documentName: stringField(),
      originalFilename: stringField(),
      mimeType: stringField(),
      sizeBytes: { type: 'integer' },
      reviewStatus: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED'] },
      reviewNote: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    }),
  },
  reviewEvents: {
    type: 'array',
    items: objectSchema({
      resourceId: stringField(),
      action: stringField(),
      metadata: { type: 'object', additionalProperties: true, nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    }),
  },
});

export const platformTenantListResponseSchema = objectSchema({
  items: { type: 'array', items: platformTenantItemSchema },
  total: { type: 'integer' },
  page: { type: 'integer' },
  pageSize: { type: 'integer' },
});

export const approvedTenantResponseSchema = objectSchema({
  approved: { type: 'boolean', enum: [true] },
});

export const rejectedTenantResponseSchema = objectSchema({
  rejected: { type: 'boolean', enum: [true] },
});

export const tenantKybDocumentResponseSchema = objectSchema({
  id: stringField(),
  tenantId: stringField(),
  documentName: stringField(),
  originalFilename: stringField(),
  mimeType: stringField(),
  sizeBytes: { type: 'integer' },
  retentionExpiresAt: { type: 'string', format: 'date-time' },
  reviewStatus: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED'] },
  reviewNote: { type: 'string', nullable: true },
  createdAt: { type: 'string', format: 'date-time' },
});

export const tenantApplicantStatusResponseSchema = objectSchema({
  name: stringField(),
  slug: stringField(),
  status: { type: 'string', enum: ['PENDING_REVIEW', 'ACTIVE', 'REJECTED'] },
  submittedAt: { type: 'string', format: 'date-time' },
  subscriptionStatus: { type: 'string', nullable: true },
  rejectionReason: { type: 'string', nullable: true },
  kybDocuments: {
    type: 'array',
    items: objectSchema({
      id: stringField(),
      documentName: stringField(),
      originalFilename: stringField(),
      mimeType: stringField(),
      sizeBytes: { type: 'integer' },
      reviewStatus: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED'] },
      reviewNote: { type: 'string', nullable: true },
      createdAt: { type: 'string', format: 'date-time' },
    }),
  },
});
