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
  email: { type: 'string', format: 'email' },
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

export const forgotPasswordResponseSchema = objectSchema({
  token: stringField(),
});

export const logoutResponseSchema = objectSchema({
  loggedOut: { type: 'boolean', enum: [true] },
});

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

export const approvedTenantResponseSchema = objectSchema({
  approved: { type: 'boolean', enum: [true] },
});
