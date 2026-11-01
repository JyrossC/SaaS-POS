import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

const openApiConfig = new DocumentBuilder()
  .setTitle('SaaS POS API')
  .setDescription('REST API for the SaaS POS platform.')
  .setVersion('0.1.0')
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'bearer',
  )
  .addBearerAuth(
    {
      type: 'http',
      scheme: 'bearer',
      bearerFormat: 'JWT',
    },
    'platformBearer',
  )
  .build();

export function createOpenApiDocument(app: INestApplication) {
  return SwaggerModule.createDocument(app, openApiConfig);
}
