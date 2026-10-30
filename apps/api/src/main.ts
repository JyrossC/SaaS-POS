import { NestFactory } from '@nestjs/core';
import { config as loadEnvironmentFile } from 'dotenv';
import { resolve } from 'node:path';
import Joi from 'joi';
import { AppModule } from './app.module';

loadEnvironmentFile({ path: resolve(__dirname, '../../../.env') });

const environmentSchema = Joi.object({
  DATABASE_URL: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
  JWT_SECRET: Joi.string().min(32).required(),
  INSTALLATION_SECRET: Joi.string().min(32).required(),
  KYB_DOCUMENT_ENCRYPTION_KEY: Joi.string()
    .required()
    .custom((value: string, helpers) => {
      const key = Buffer.from(value, 'base64');
      if (key.length !== 32 || key.toString('base64') !== value) {
        return helpers.error('any.invalid');
      }
      return value;
    })
    .messages({
      'any.invalid': 'KYB_DOCUMENT_ENCRYPTION_KEY must be a base64-encoded 32-byte key.',
    }),
  JWT_EXPIRES_IN: Joi.string().pattern(/^[1-9]\d*(s|m|h|d)$/).default('15m'),
  CORS_ORIGINS: Joi.string().default('http://localhost:5173'),
  PORT: Joi.number().integer().min(1).max(65535).default(3000),
  PRIVATE_STORAGE_PATH: Joi.string().optional(),
}).unknown(true);

async function bootstrap() {
  const { error, value: environment } = environmentSchema.validate(process.env, {
    abortEarly: false,
    convert: true,
  });
  if (error) {
    const missingOrInvalid = error.details.map(({ path }) => path.join('.')).join(', ');
    throw new Error(`Invalid environment configuration: ${missingOrInvalid}`);
  }

  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: environment.CORS_ORIGINS.split(',').map((origin: string) => origin.trim()),
  });
  await app.listen(environment.PORT);
}

void bootstrap();
