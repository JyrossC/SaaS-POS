import { SchemaObject } from '@nestjs/swagger';

const stringField = (nullable = false): SchemaObject => ({
  type: 'string',
  ...(nullable ? { nullable: true } : {}),
});

const objectSchema = (
  properties: Record<string, SchemaObject>,
  required: string[] = [],
): SchemaObject => ({
  type: 'object',
  properties,
  additionalProperties: true,
  ...(required.length > 0 ? { required } : {}),
});

export const aiQueryBodySchema = objectSchema(
  {
    query: stringField(),
    storeId: stringField(),
    startDate: stringField(),
    endDate: stringField(),
  },
  ['query'],
);

export const changePlanBodySchema = objectSchema(
  { planCode: stringField() },
  ['planCode'],
);

export const renewSubscriptionBodySchema = objectSchema({
  planCode: stringField(),
});

export const reasonBodySchema = objectSchema({ reason: stringField() });

export const processDueJobsBodySchema = objectSchema({
  limit: { type: 'number' },
});

export const enqueueJobBodySchema = objectSchema(
  {
    type: stringField(),
    data: { type: 'object', additionalProperties: true },
    tenantId: stringField(),
    maxAttempts: { type: 'number' },
    runAt: stringField(),
  },
  ['type', 'data'],
);

export const createSaleBodySchema = objectSchema(
  {
    storeId: stringField(),
    items: {
      type: 'array',
      items: objectSchema(
        { productId: stringField(), quantity: stringField() },
        ['productId', 'quantity'],
      ),
    },
    payments: {
      type: 'array',
      items: objectSchema(
        {
          paymentMethod: stringField(),
          amount: stringField(),
          reference: stringField(true),
        },
        ['paymentMethod', 'amount'],
      ),
    },
    notes: stringField(true),
    idempotencyKey: stringField(),
    campaignId: stringField(true),
    promoCode: stringField(true),
  },
  ['storeId', 'items', 'payments', 'idempotencyKey'],
);

export const createRefundBodySchema = objectSchema(
  {
    saleId: stringField(),
    reason: stringField(),
    items: {
      type: 'array',
      items: objectSchema(
        { saleItemId: stringField(), quantity: stringField() },
        ['saleItemId', 'quantity'],
      ),
    },
  },
  ['saleId', 'reason', 'items'],
);

export const openCashSessionBodySchema = objectSchema(
  { storeId: stringField(), openingBalance: stringField() },
  ['storeId', 'openingBalance'],
);

export const closeCashSessionBodySchema = objectSchema(
  { closingBalance: stringField(), notes: stringField(true) },
  ['closingBalance'],
);

export const createDrugDetailBodySchema = objectSchema(
  {
    productId: stringField(),
    genericName: stringField(true),
    brandName: stringField(true),
    strength: stringField(true),
    dosageForm: stringField(true),
    manufacturer: stringField(true),
    regulatoryCategory: stringField(true),
    prescriptionRequired: { type: 'boolean' },
  },
  ['productId'],
);

export const createBatchBodySchema = objectSchema(
  {
    storeId: stringField(),
    productId: stringField(),
    batchNumber: stringField(),
    supplierId: stringField(true),
    manufacturedAt: stringField(true),
    expiresAt: stringField(),
    quantityReceived: stringField(),
    costPerUnit: stringField(true),
  },
  ['storeId', 'productId', 'batchNumber', 'expiresAt', 'quantityReceived'],
);

export const dispenseBodySchema = objectSchema(
  {
    storeId: stringField(),
    prescriptionId: stringField(true),
    items: {
      type: 'array',
      items: objectSchema(
        { productId: stringField(), quantity: stringField() },
        ['productId', 'quantity'],
      ),
    },
    notes: stringField(true),
  },
  ['storeId', 'items'],
);

export const quarantineBodySchema = objectSchema(
  {
    storeId: stringField(),
    batchId: stringField(),
    quantity: stringField(),
    reason: stringField(),
  },
  ['storeId', 'batchId', 'quantity', 'reason'],
);

export const createSupplierBodySchema = objectSchema(
  {
    name: stringField(),
    contactName: stringField(true),
    email: stringField(true),
    phone: stringField(true),
    address: stringField(true),
  },
  ['name'],
);

export const updateSupplierBodySchema = objectSchema({
  name: stringField(),
  contactName: stringField(true),
  email: stringField(true),
  phone: stringField(true),
  address: stringField(true),
  status: { type: 'string', enum: ['ACTIVE', 'INACTIVE'] },
});

export const createPurchaseOrderBodySchema = objectSchema(
  {
    storeId: stringField(),
    supplierId: stringField(),
    items: {
      type: 'array',
      items: objectSchema(
        {
          productId: stringField(),
          quantityOrdered: stringField(),
          unitCost: stringField(),
        },
        ['productId', 'quantityOrdered', 'unitCost'],
      ),
    },
    notes: stringField(true),
  },
  ['storeId', 'supplierId', 'items'],
);

export const receiveGoodsBodySchema = objectSchema(
  {
    storeId: stringField(),
    purchaseOrderId: stringField(true),
    items: {
      type: 'array',
      items: objectSchema(
        {
          productId: stringField(),
          quantityReceived: stringField(),
          unitCost: stringField(),
        },
        ['productId', 'quantityReceived', 'unitCost'],
      ),
    },
  },
  ['storeId', 'items'],
);
