import { ApiResponse, SchemaObject } from '@nestjs/swagger';

export function ApiResponseSchema(
  status: number,
  schema: SchemaObject,
): MethodDecorator {
  return ApiResponse({ status, schema });
}
