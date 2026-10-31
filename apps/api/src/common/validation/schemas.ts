import Joi from 'joi';

export const loginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  tenantSlug: Joi.string().trim().lowercase().pattern(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).required(),
  password: Joi.string().min(8).required(),
}).required();

export const installationSchema = Joi.object({
  platformName: Joi.string().trim().min(1).max(120).required(),
  adminName: Joi.string().trim().min(1).max(120).required(),
  adminEmail: Joi.string().trim().email().required(),
  password: Joi.string().min(12).max(128).required(),
}).required();

export const platformLoginSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  password: Joi.string().min(1).max(128).required(),
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
  ownerEmail: Joi.string().trim().email().required(),
  password: Joi.string().min(12).max(128).required(),
  planCode: Joi.string().trim().min(1).max(60).required(),
}).required();

export const acceptInvitationSchema = Joi.object({
  token: Joi.string().trim().min(1).required(),
  name: Joi.string().trim().min(2).max(120).required(),
  password: Joi.string().min(12).max(128).required(),
}).required();

export const inviteStaffSchema = Joi.object({
  email: Joi.string().trim().email().required(),
  roleId: Joi.string().trim().required(),
}).required();

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
  email: Joi.string().trim().email().required(),
}).required();

export const resetPasswordSchema = Joi.object({
  token: Joi.string().trim().required(),
  password: Joi.string().min(12).max(128).required(),
}).required();

