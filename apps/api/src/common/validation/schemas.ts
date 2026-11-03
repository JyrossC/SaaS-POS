import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  tenantSlug: Joi.string().trim().lowercase().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).required(),
  password: Joi.string().min(8).required(),
  mfaCode: Joi.string().trim().max(64).optional(),
}).required();

export const emailVerificationSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
}).required();

export const mfaCodeSchema = Joi.object({
  code: Joi.string().trim().min(6).max(64).required(),
}).required();

export const emailSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
}).required();

export const installationSchema = Joi.object({
  platformName: Joi.string().trim().min(1).max(120).required(),
  adminName: Joi.string().trim().min(1).max(120).required(),
  adminEmail: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(12).max(128).required(),
}).required();

export const platformLoginSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(1).max(128).required(),
  mfaCode: Joi.string().trim().max(64).optional(),
}).required();

export const platformSetupTokenSchema = Joi.object({
  setupToken: Joi.string().trim().min(32).max(2048).required(),
}).required();

export const platformMfaConfirmationSchema = Joi.object({
  setupToken: Joi.string().trim().min(32).max(2048).required(),
  code: Joi.string().trim().min(6).max(64).required(),
}).required();

export const kybDocumentUploadSchema = Joi.object({
  documentName: Joi.string().trim().min(1).max(120).required(),
}).required();

export const kybDocumentReviewSchema = Joi.object({
  status: Joi.string().valid('ACCEPTED', 'REJECTED').required(),
  note: Joi.string().trim().min(1).max(1000).when('status', {
    is: 'REJECTED',
    then: Joi.required(),
    otherwise: Joi.optional().allow(''),
  }),
}).required();

export const tenantRejectionSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(1000).required(),
}).required();

export const platformTenantListSchema = Joi.object({
  search: Joi.string().trim().max(200).optional(),
  status: Joi.string().valid('PENDING_REVIEW', 'ACTIVE', 'REJECTED', 'SUSPENDED').optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
}).required();

export const platformAdminInvitationSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  name: Joi.string().trim().min(1).max(120).required(),
}).required();

export const platformAdminInvitationAcceptanceSchema = Joi.object({
  token: Joi.string().trim().min(32).max(256).required(),
  password: Joi.string().min(12).max(128).required(),
}).required();

export const platformAdminStatusSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'DISABLED').required(),
}).required();

export const platformTenantStatusSchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'SUSPENDED').required(),
}).required();

const platformPlanVersionSchema = {
  trialDays: Joi.number().integer().min(0).max(365).required(),
  billingPeriodDays: Joi.number().integer().min(1).max(365).required(),
  currency: Joi.string().trim().uppercase().length(3).pattern(/^[A-Z]{3}$/).required(),
  price: Joi.string().pattern(/^\d{1,15}(?:\.\d{1,4})?$/).allow(null).required(),
  entitlements: Joi.object()
    .pattern(/^[a-z][a-z0-9_.-]{0,79}$/, Joi.any())
    .max(100)
    .required(),
};

export const platformPlanCreateSchema = Joi.object({
  code: Joi.string().trim().uppercase().pattern(/^[A-Z0-9][A-Z0-9_-]{1,39}$/).required(),
  name: Joi.string().trim().min(1).max(120).required(),
  ...platformPlanVersionSchema,
}).required();

export const platformPlanVersionCreateSchema = Joi.object(platformPlanVersionSchema).required();

export const platformPlanAvailabilitySchema = Joi.object({
  isAvailable: Joi.boolean().required(),
}).required();

export const fiscalJurisdictionSchema = Joi.string()
  .valid('MAINLAND_TANZANIA', 'ZANZIBAR')
  .required();

const fiscalCredentialsSchema = Joi.object()
  .pattern(/^[A-Za-z][A-Za-z0-9_.-]{0,63}$/, Joi.string().max(4096))
  .min(1)
  .max(20);

const fiscalNullableHttpsUrl = Joi.string()
  .trim()
  .uri({ scheme: ['https'] })
  .max(2048)
  .allow(null);

export const fiscalProviderConfigurationSchema = Joi.object({
  providerName: Joi.string().trim().min(1).max(120).required(),
  productionEndpoint: fiscalNullableHttpsUrl.required(),
  sandboxEndpoint: fiscalNullableHttpsUrl.required(),
  documentationUrl: fiscalNullableHttpsUrl.required(),
  approvalStatus: Joi.string()
    .valid('UNVERIFIED', 'SANDBOX_VALIDATED', 'AUTHORITY_APPROVED')
    .required(),
  approvalEvidenceReference: Joi.string().trim().max(500).allow(null, '').required(),
  isAvailable: Joi.boolean().required(),
  credentials: fiscalCredentialsSchema.optional(),
  clearCredentials: Joi.boolean().default(false),
}).required();

export const fiscalAddonOfferSchema = Joi.object({
  isAvailable: Joi.boolean().required(),
  monthlyPrice: Joi.string().pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/).allow(null).required(),
  annualPrice: Joi.string().pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/).allow(null).required(),
}).required();

export const fiscalAddonRequestUpdateSchema = Joi.object({
  status: Joi.string().valid('CONTACTED', 'CLOSED').required(),
  message: Joi.string().trim().max(1000).allow(null, '').optional(),
}).required();

export const fiscalAddonCheckoutSchema = Joi.object({
  jurisdiction: fiscalJurisdictionSchema,
  billingPeriod: Joi.string().valid('MONTHLY', 'ANNUAL').required(),
}).required();

export const fiscalAddonPaymentSimulationSchema = Joi.object({
  outcome: Joi.string().valid('PAID', 'FAILED', 'CANCELED', 'TIMEOUT').required(),
  idempotencyKey: Joi.string().guid({ version: ['uuidv4'] }).required(),
}).required();

export const tenantFiscalProfileSchema = Joi.object({
  legalName: Joi.string().trim().max(200).allow(null, '').required(),
  taxIdentificationNumber: Joi.string().trim().max(64).allow(null, '').required(),
  vatRegistrationNumber: Joi.string().trim().max(64).allow(null, '').required(),
  providerConfigurationId: Joi.string().trim().max(128).allow(null).required(),
  credentials: fiscalCredentialsSchema.optional(),
  clearCredentials: Joi.boolean().default(false),
}).required();

export const tenantFiscalAddonRequestSchema = Joi.object({
  jurisdiction: fiscalJurisdictionSchema,
  message: Joi.string().trim().max(1000).allow(null, '').optional(),
}).required();

export const fiscalSimulationSchema = Joi.object({
  jurisdiction: fiscalJurisdictionSchema,
  scenario: Joi.string()
    .valid('ACCEPTED', 'REJECTED', 'TIMEOUT', 'DUPLICATE', 'RECOVERED')
    .required(),
}).required();

export const platformTenantPlanAssignmentSchema = Joi.object({
  planVersionId: Joi.string().trim().min(1).max(128).required(),
}).required();

export const platformSupportAccessSchema = Joi.object({
  tenantId: Joi.string().trim().min(1).max(128).required(),
  purpose: Joi.string().trim().min(10).max(1000).required(),
  scopes: Joi.array()
    .items(Joi.string().valid('tenant_profile', 'stores', 'products', 'sales_summary'))
    .min(1)
    .unique()
    .required(),
  durationMinutes: Joi.number().integer().min(5).max(60).default(30),
}).required();

export const updateBusinessSettingsSchema = Joi.object({
  name: Joi.string().trim().min(1).max(120).required(),
  businessAddress: Joi.string().trim().max(500).allow('', null).required(),
  contactEmail: Joi.string().trim().lowercase().email().max(254).allow('', null).required(),
  contactPhone: Joi.string().trim().max(40).allow('', null).required(),
}).required();

export const paymentProviderNameSchema = Joi.string()
  .valid('AZAMPAY', 'STRIPE', 'BANK_TRANSFER')
  .required();

export const paymentProviderConfigSchema = Joi.object({
  displayName: Joi.string().trim().min(1).max(120).optional(),
  isEnabled: Joi.boolean().optional(),
  isSandbox: Joi.boolean().optional(),
  apiKey: Joi.alternatives().try(Joi.string().trim().allow('').allow(null), null).optional(),
  secretKey: Joi.alternatives().try(Joi.string().trim().allow('').allow(null), null).optional(),
  publicKey: Joi.alternatives().try(Joi.string().trim().allow('').allow(null), null).optional(),
  accountId: Joi.alternatives().try(Joi.string().trim().allow('').allow(null), null).optional(),
  metadata: Joi.object().unknown(true).optional(),
}).required();

export const tenantScopeSchema = Joi.object({
  tenantId: Joi.string().trim().required(),
  storeId: Joi.string().trim().optional(),
}).required();

export const productIdSchema = Joi.string().trim().required();

export const storeIdSchema = Joi.string().trim().required();

export const createStoreSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  code: Joi.string().trim().min(1).max(32).pattern(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/).required(),
  location: Joi.string().trim().max(500).allow(null, '').optional(),
}).required();

export const updateStoreSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  code: Joi.string().trim().min(1).max(32).pattern(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/).optional(),
  location: Joi.string().trim().max(500).allow(null, '').optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
}).required();

export const listStoresSchema = Joi.object({
  search: Joi.string().trim().max(200).optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
  status: Joi.string().valid('ACTIVE', 'INACTIVE').optional(),
}).required();

export const createProductSchema = Joi.object({
  sku: Joi.string().trim().min(1).max(64).required(),
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(2000).allow(null, '').optional(),
  baseUnit: Joi.string().trim().min(1).max(32).required(),
  sellingPrice: Joi.string()
    .pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/)
    .required(),
  costPrice: Joi.string()
    .pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/)
    .allow(null)
    .optional(),
}).required();

export const listProductsSchema = Joi.object({
  search: Joi.string().trim().max(200).optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
  includeArchived: Joi.boolean().default(false),
}).required();

export const inventoryStoreIdSchema = Joi.string().trim().required();

export const adjustStockSchema = Joi.object({
  productId: Joi.string().trim().required(),
  quantityDelta: Joi.string()
    .pattern(/^-?(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/)
    .invalid('0', '-0', '0.0', '-0.0', '0.00', '-0.00', '0.000', '-0.000', '0.0000', '-0.0000')
    .required(),
  reason: Joi.string().trim().min(1).max(500).required(),
}).required();

export const registerTenantSchema = Joi.object({
  tenantName: Joi.string().trim().min(2).max(120).required(),
  tenantSlug: Joi.string().trim().lowercase().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).min(2).max(60).required(),
  businessType: Joi.string().valid('RETAIL', 'PHARMACY', 'HYBRID').required(),
  ownerName: Joi.string().trim().min(2).max(120).required(),
  ownerEmail: Joi.string().trim().lowercase().email().required(),
  password: Joi.string().min(12).max(128).required(),
  planCode: Joi.string().trim().min(1).max(60).required(),
}).required();

export const acceptInvitationSchema = Joi.object({
  token: Joi.string().trim().min(1).required(),
  name: Joi.string().trim().min(2).max(120).required(),
  password: Joi.string().min(12).max(128).required(),
}).required();

export const inviteStaffSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
  roleId: Joi.string().trim().required(),
}).required();

const rolePermissionCodes = Joi.array()
  .items(Joi.string().trim().min(1).max(100))
  .unique()
  .max(100);

export const createTenantRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).required(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
  permissionCodes: rolePermissionCodes.optional(),
}).required();

export const updateTenantRoleSchema = Joi.object({
  name: Joi.string().trim().min(2).max(80).optional(),
  description: Joi.string().trim().max(500).allow(null, '').optional(),
  permissionCodes: rolePermissionCodes.optional(),
}).min(1).required();

// Query parameter validation schemas

export const paginationSchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
}).required();

export const storeIdQuerySchema = Joi.object({
  storeId: Joi.string().trim().optional(),
}).required();

export const statusQuerySchema = Joi.object({
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'DRAFT', 'APPROVED', 'PENDING', 'COMPLETED', 'VOIDED', 'REFUNDED').optional(),
}).required();

export const searchQuerySchema = Joi.object({
  search: Joi.string().trim().max(200).optional(),
}).required();

export const productIdParamSchema = Joi.object({
  productId: Joi.string().trim().required(),
}).required();

export const saleIdParamSchema = Joi.object({
  saleId: Joi.string().trim().required(),
}).required();

export const orderIdParamSchema = Joi.object({
  orderId: Joi.string().trim().required(),
}).required();

export const supplierIdParamSchema = Joi.object({
  supplierId: Joi.string().trim().required(),
}).required();

export const quarantineIdParamSchema = Joi.object({
  quarantineId: Joi.string().trim().required(),
}).required();

export const invoiceIdParamSchema = Joi.object({
  invoiceId: Joi.string().trim().required(),
}).required();

export const recordPaymentBodySchema = Joi.object({
  amount: Joi.string()
    .pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/)
    .required(),
  providerReference: Joi.string().trim().allow('').allow(null, '').optional(),
}).required();

export const daysQuerySchema = Joi.object({
  days: Joi.number().integer().min(1).max(365).default(30),
}).required();

export const lowStockThresholdQuerySchema = Joi.object({
  lowStockThreshold: Joi.number().integer().min(0).default(10),
}).required();

export const prescriptionIdParamSchema = Joi.object({
  prescriptionId: Joi.string().trim().required(),
}).required();

export const createPrescriptionSchema = Joi.object({
  storeId: Joi.string().trim().required(),
  patientName: Joi.string().trim().max(200).allow(null, '').optional(),
  patientId: Joi.string().trim().max(100).allow(null, '').optional(),
  prescriberName: Joi.string().trim().max(200).allow(null, '').optional(),
  prescriberLicense: Joi.string().trim().max(100).allow(null, '').optional(),
  items: Joi.array()
    .items(
      Joi.object({
        productId: Joi.string().trim().required(),
        quantityPrescribed: Joi.string()
          .pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/)
          .invalid('0', '-0', '0.0', '-0.0', '0.00', '-0.00', '0.000', '-0.000', '0.0000', '-0.0000')
          .required(),
      }),
    )
    .min(1)
    .required(),
}).required();

export const paymentWebhookSignatureSchema = Joi.string().trim().required();

export const paymentWebhookBodySchema = Joi.object({
  provider: Joi.string().valid('AZAMPAY', 'STRIPE', 'BANK_TRANSFER').required(),
  eventType: Joi.string().trim().required(),
  providerRef: Joi.string().trim().required(),
  invoiceId: Joi.string().trim().optional(),
  amount: Joi.string()
    .pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/)
    .required(),
  currency: Joi.string().trim().max(3).required(),
  status: Joi.string().valid('PAID', 'FAILED', 'CANCELED', 'PENDING').required(),
  metadata: Joi.object().optional(),
  signature: Joi.string().trim().required(),
}).required();

export const forgotPasswordSchema = Joi.object({
  email: Joi.string().trim().lowercase().email().required(),
}).required();

export const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required(),
  password: Joi.string().min(12).max(128).required(),
}).required();

export const campaignIdParamSchema = Joi.object({
  campaignId: Joi.string().trim().required(),
}).required();

export const customerSegmentIdParamSchema = Joi.object({
  segmentId: Joi.string().trim().required(),
  customerId: Joi.string().trim().required(),
}).required();

export const createCampaignSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  description: Joi.string().trim().max(1000).allow(null, '').optional(),
  type: Joi.string().valid('PERCENTAGE_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'BUY_X_GET_Y', 'BUNDLE_PRICING', 'TIERED_SPEND').required(),
  mechanism: Joi.string().valid('PROMO_CODE', 'AUTOMATIC', 'BOTH').required(),
  promoCode: Joi.string().trim().max(50).allow(null, '').optional(),
  value: Joi.string().pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/).required(),
  buyQuantity: Joi.number().integer().min(1).optional(),
  getQuantity: Joi.number().integer().min(1).optional(),
  scope: Joi.string().valid('TENANT_WIDE').optional(),
  customerTargeting: Joi.string().valid('ALL_CUSTOMERS', 'LOYALTY_MEMBERS', 'FIRST_TIME_BUYERS', 'SEGMENT_BASED').optional(),
  segmentIds: Joi.array().items(Joi.string().trim()).optional(),
  startDate: Joi.string().isoDate().required(),
  endDate: Joi.string().isoDate().allow(null).optional(),
  recurrenceType: Joi.string().valid('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY').optional(),
  recurrenceInterval: Joi.number().integer().min(1).optional(),
  maxUses: Joi.number().integer().min(1).optional(),
  maxUsesPerCustomer: Joi.number().integer().min(1).optional(),
  maxUsesPerCustomerPerDay: Joi.number().integer().min(1).optional(),
  maxUsesPerStore: Joi.number().integer().min(1).optional(),
  minOrderAmount: Joi.string().pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/).allow(null).optional(),
  minQuantity: Joi.number().integer().min(1).optional(),
  allowedPaymentMethods: Joi.array().items(Joi.string().trim()).optional(),
  stackingRule: Joi.string().valid('STACKABLE', 'BEST_ONLY', 'EXCLUSIVE').optional(),
  productIds: Joi.array().items(Joi.string().trim()).optional(),
}).required();

export const updateCampaignSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  description: Joi.string().trim().max(1000).allow(null, '').optional(),
  type: Joi.string().valid('PERCENTAGE_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'BUY_X_GET_Y', 'BUNDLE_PRICING', 'TIERED_SPEND').optional(),
  mechanism: Joi.string().valid('PROMO_CODE', 'AUTOMATIC', 'BOTH').optional(),
  promoCode: Joi.string().trim().max(50).allow(null, '').optional(),
  value: Joi.string().pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/).optional(),
  buyQuantity: Joi.number().integer().min(1).optional(),
  getQuantity: Joi.number().integer().min(1).optional(),
  scope: Joi.string().valid('TENANT_WIDE').optional(),
  customerTargeting: Joi.string().valid('ALL_CUSTOMERS', 'LOYALTY_MEMBERS', 'FIRST_TIME_BUYERS', 'SEGMENT_BASED').optional(),
  segmentIds: Joi.array().items(Joi.string().trim()).optional(),
  startDate: Joi.string().isoDate().optional(),
  endDate: Joi.string().isoDate().allow(null).optional(),
  recurrenceType: Joi.string().valid('NONE', 'DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY').optional(),
  recurrenceInterval: Joi.number().integer().min(1).optional(),
  maxUses: Joi.number().integer().min(1).optional(),
  maxUsesPerCustomer: Joi.number().integer().min(1).optional(),
  maxUsesPerCustomerPerDay: Joi.number().integer().min(1).optional(),
  maxUsesPerStore: Joi.number().integer().min(1).optional(),
  minOrderAmount: Joi.string().pattern(/^(?:0|[1-9]\d{0,14})(?:\.\d{1,4})?$/).allow(null).optional(),
  minQuantity: Joi.number().integer().min(1).optional(),
  allowedPaymentMethods: Joi.array().items(Joi.string().trim()).optional(),
  stackingRule: Joi.string().valid('STACKABLE', 'BEST_ONLY', 'EXCLUSIVE').optional(),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED').optional(),
  productIds: Joi.array().items(Joi.string().trim()).optional(),
}).required();

export const campaignQuerySchema = Joi.object({
  storeId: Joi.string().trim().optional(),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'PAUSED', 'EXPIRED').optional(),
  type: Joi.string().valid('PERCENTAGE_DISCOUNT', 'FIXED_AMOUNT_DISCOUNT', 'BUY_X_GET_Y', 'BUNDLE_PRICING', 'TIERED_SPEND').optional(),
  search: Joi.string().trim().optional(),
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(25),
}).required();

export const createCustomerSegmentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).required(),
  type: Joi.string().valid('LOYALTY', 'FIRST_TIME', 'VIP', 'INACTIVE', 'CUSTOM').required(),
  rules: Joi.object().default({}),
  description: Joi.string().trim().max(1000).allow(null, '').optional(),
}).required();

export const updateCustomerSegmentSchema = Joi.object({
  name: Joi.string().trim().min(1).max(200).optional(),
  type: Joi.string().valid('LOYALTY', 'FIRST_TIME', 'VIP', 'INACTIVE', 'CUSTOM').optional(),
  rules: Joi.object().optional(),
  description: Joi.string().trim().max(1000).allow(null, '').optional(),
}).required();
