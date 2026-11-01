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
    expect(Object.keys(document.paths)).toHaveLength(79);
    expect(operations).toHaveLength(99);
    expect(requestBodies).toHaveLength(40);

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
    expect(document.paths['/api/v1/auth/login']?.post?.security).toBeUndefined();
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

    expect(reviewSchema?.oneOf).toHaveLength(2);
    expect(uploadSchema?.properties).toEqual(expect.objectContaining({
      document: { type: 'string', format: 'binary' },
    }));
    expect(healthSchema?.oneOf).toHaveLength(2);

    const operationsWithResponseSchemas = operations.filter(({ operation }) =>
      Object.values(operation.responses ?? {}).some((response) =>
        Boolean(response.content?.['application/json']?.schema),
      ),
    );
    expect(operationsWithResponseSchemas).toHaveLength(12);
  });
});
