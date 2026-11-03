import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type OpenApiOperation = {
  requestBody?: {
    required?: boolean;
    content?: Record<string, { schema?: Record<string, unknown> }>;
  };
  responses?: Record<string, {
    content?: Record<string, { schema?: Record<string, unknown> }>;
  }>;
  security?: Array<Record<string, string[]>>;
};

const document = JSON.parse(
  readFileSync(
    resolve(dirname(fileURLToPath(import.meta.url)), '../../../../../documentations/api/openapi.json'),
    'utf8',
  ),
) as {
  openapi: string;
  info: { title: string };
  paths: Record<string, Record<string, OpenApiOperation>>;
};

const httpMethods = new Set(['get', 'post', 'put', 'patch', 'delete']);
const operations = Object.entries(document.paths).flatMap(([path, pathItem]) =>
  Object.entries(pathItem)
    .filter(([method]) => httpMethods.has(method))
    .map(([method, operation]) => ({ path, method, operation })),
);

describe('generated OpenAPI contract', () => {
  it('keeps the expected route inventory and documents every request body', () => {
    const requestBodies = operations.filter(({ operation }) => operation.requestBody);

    expect(document.openapi).toBe('3.0.0');
    expect(document.info.title).toBe('SaaS POS API');
    expect(Object.keys(document.paths)).toHaveLength(126);
    expect(operations).toHaveLength(151);
    expect(requestBodies).toHaveLength(68);

    for (const { path, method, operation } of requestBodies) {
      expect({
        path,
        method,
        content: operation.requestBody?.content,
      }).toEqual(expect.objectContaining({
        content: expect.any(Object),
      }));

      for (const mediaType of Object.values(operation.requestBody?.content ?? {})) {
        expect(mediaType.schema).toBeDefined();
      }
    }
  });

  it('marks bodies optional only on operations that accept omitted input', () => {
    const optionalBodies = operations
      .filter(({ operation }) => operation.requestBody?.required === false)
      .map(({ path, method }) => `${method.toUpperCase()} ${path}`)
      .sort();

    expect(optionalBodies).toEqual([
      'POST /api/v1/jobs/process-due',
      'POST /api/v1/sales/{saleId}/void',
      'POST /api/v1/subscription/suspend',
    ]);
  });

  it('keeps authentication schemes and public login requirements accurate', () => {
    expect(document.paths['/api/v1/products']?.get?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/platform/me']?.get?.security)
      .toContainEqual({ platformBearer: [] });
    expect(document.paths['/api/v1/platform/stats']?.get?.security)
      .toContainEqual({ platformBearer: [] });
    expect(document.paths['/api/v1/platform/tenants']?.get?.security)
      .toContainEqual({ platformBearer: [] });
    expect(document.paths['/api/v1/platform/admins']?.get?.security)
      .toContainEqual({ platformBearer: [] });
    expect(document.paths['/api/v1/platform/plans']?.post?.security)
      .toContainEqual({ platformBearer: [] });
    expect(document.paths['/api/v1/platform/support-access']?.post?.security)
      .toContainEqual({ platformBearer: [] });
    expect(document.paths['/api/v1/platform/auth/invitation/accept']?.post?.security)
      .toBeUndefined();
    expect(document.paths['/api/v1/auth/login']?.post?.security).toBeUndefined();
    expect(document.paths['/api/v1/tenant/staff/{membershipId}/deactivate']?.patch?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/roles']?.post?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/roles/{roleId}']?.patch?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/permissions']?.get?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/settings']?.get?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/settings']?.patch?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/platform/fiscalization']?.get?.security)
      .toContainEqual({ platformBearer: [] });
    expect(document.paths['/api/v1/platform/fiscalization/providers/{jurisdiction}']?.put?.security)
      .toContainEqual({ platformBearer: [] });
    expect(document.paths['/api/v1/tenant/fiscalization']?.get?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/fiscalization/profiles/{jurisdiction}']?.patch?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/fiscalization/simulator/run']?.post?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/fiscalization/addon-subscriptions']?.get?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/fiscalization/addon-subscriptions/checkout']?.post?.security)
      .toContainEqual({ bearer: [] });
    expect(document.paths['/api/v1/tenant/fiscalization/addon-invoices/{invoiceId}/simulate-payment']?.post?.security)
      .toContainEqual({ bearer: [] });
  });

  it('documents critical conditional, multipart, and response contracts', () => {
    const reviewSchema = document.paths[
      '/api/v1/platform/tenants/{tenantId}/kyb-documents/{documentId}/review'
    ]?.patch?.requestBody?.content?.['application/json']?.schema;
    const uploadSchema = document.paths[
      '/api/v1/platform/tenants/{tenantId}/kyb-documents'
    ]?.post?.requestBody?.content?.['multipart/form-data']?.schema;
    const healthSchema = document.paths['/api/v1/health']?.get?.responses?.['200']
      ?.content?.['application/json']?.schema;
    const rejectOperation = document.paths[
      '/api/v1/platform/tenants/{tenantId}/reject'
    ]?.post;
    const rejectionSchema = rejectOperation?.requestBody?.content?.['application/json']?.schema;
    const registrationResponse = document.paths['/api/v1/auth/register']?.post?.responses?.['201']
      ?.content?.['application/json']?.schema;
    const fiscalAddonPaymentResponse = document.paths[
      '/api/v1/tenant/fiscalization/addon-invoices/{invoiceId}/simulate-payment'
    ]?.post?.responses?.['200']?.content?.['application/json']?.schema;
    const applicantStatusOperation = document.paths['/api/v1/tenant/onboarding/status']?.get;
    const applicantUploadOperation = document.paths['/api/v1/tenant/onboarding/kyb-documents']?.post;
    const applicantUploadSchema = applicantUploadOperation?.requestBody?.content?.['multipart/form-data']?.schema;
    const businessSettingsSchema = document.paths['/api/v1/tenant/settings']?.get?.responses?.['200']
      ?.content?.['application/json']?.schema;

    expect(reviewSchema?.oneOf).toHaveLength(2);
    expect(uploadSchema?.properties).toEqual(expect.objectContaining({
      document: { type: 'string', format: 'binary' },
    }));
    expect(healthSchema?.oneOf).toHaveLength(2);
    expect(rejectionSchema?.properties).toEqual(expect.objectContaining({
      reason: expect.objectContaining({ type: 'string', minLength: 1, maxLength: 1000 }),
    }));
    expect(rejectOperation?.security).toContainEqual({ platformBearer: [] });
    expect(registrationResponse?.properties).toEqual(expect.objectContaining({
      status: { type: 'string', enum: ['PENDING_REVIEW'] },
    }));
    expect(fiscalAddonPaymentResponse?.properties).toEqual(expect.objectContaining({
      simulationOnly: { type: 'boolean', enum: [true] },
      realChargeMade: { type: 'boolean', enum: [false] },
    }));
    expect(applicantStatusOperation?.security).toContainEqual({ bearer: [] });
    expect(applicantUploadOperation?.security).toContainEqual({ bearer: [] });
    expect(applicantUploadSchema?.properties).toEqual(expect.objectContaining({
      document: { type: 'string', format: 'binary' },
    }));
    expect(businessSettingsSchema?.properties).toEqual(expect.objectContaining({
      currency: { type: 'string', enum: ['TZS'] },
      timezone: { type: 'string', enum: ['Africa/Dar_es_Salaam'] },
      taxEnabled: { type: 'boolean', enum: [false] },
    }));
    expect(document.paths['/api/v1/tenant/fiscalization']?.get?.responses?.['200']
      ?.content?.['application/json']?.schema?.properties).toEqual(expect.objectContaining({
      taxCalculationEnabled: { type: 'boolean', enum: [false] },
      fiscalReceiptIssuanceEnabled: { type: 'boolean', enum: [false] },
    }));
    expect(document.paths['/api/v1/tenant/fiscalization/simulator/run']?.post?.responses?.['200']
      ?.content?.['application/json']?.schema?.properties).toEqual(expect.objectContaining({
      simulationOnly: { type: 'boolean', enum: [true] },
      officialReceiptIssued: { type: 'boolean', enum: [false] },
      providerContacted: { type: 'boolean', enum: [false] },
    }));

    const operationsWithResponseSchemas = operations.filter(({ operation }) =>
      Object.values(operation.responses ?? {}).some((response) =>
        Boolean(response.content?.['application/json']?.schema),
      ),
    );
    expect(operationsWithResponseSchemas).toHaveLength(57);
  });
});
