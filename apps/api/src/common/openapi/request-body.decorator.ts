import { ApiBody, SchemaObject } from '@nestjs/swagger';

export function ApiRequestBody(
  schema: SchemaObject,
  required = true,
): MethodDecorator {
  return ApiBody({ required, schema });
}
