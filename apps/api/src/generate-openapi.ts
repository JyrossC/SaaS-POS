import { NestFactory } from '@nestjs/core';
import { config as loadEnvironmentFile } from 'dotenv';
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { AppModule } from './app.module';
import { createOpenApiDocument } from './openapi';

async function generateOpenApi() {
  loadEnvironmentFile({ path: resolve(__dirname, '../../../.env') });

  const app = await NestFactory.create(AppModule, { logger: false });
  try {
    app.setGlobalPrefix('api/v1');
    const document = createOpenApiDocument(app);
    const outputPath = resolve(__dirname, '../../../documentations/api/openapi.json');
    await mkdir(dirname(outputPath), { recursive: true });
    await writeFile(outputPath, `${JSON.stringify(document, null, 2)}\n`, 'utf8');
    console.log(`OpenAPI specification written to ${outputPath}`);
  } finally {
    await app.close();
  }
}

void generateOpenApi().catch((error: unknown) => {
  console.error('Failed to generate the OpenAPI specification.', error);
  process.exitCode = 1;
});
