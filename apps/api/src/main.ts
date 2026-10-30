import { NestFactory } from '@nestjs/core';
import { config as loadEnvironmentFile } from 'dotenv';
import { resolve } from 'node:path';
import Joi from 'joi';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { AppModule } from './app.module';
import * as express from 'express';
import { LoggingService } from './logging/logging.service';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ValidationPipe } from '@nestjs/common';

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
  NODE_ENV: Joi.string().valid('development', 'production', 'test').default('development'),
  RATE_LIMIT_WINDOW_MS: Joi.number().integer().min(1000).default(900000),
  RATE_LIMIT_MAX: Joi.number().integer().min(1).default(100),
  LOGIN_RATE_LIMIT_MAX: Joi.number().integer().min(1).default(10),
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

  const app = await NestFactory.create(AppModule, {
    logger: environment.NODE_ENV === 'production' ? false : undefined,
  });

  app.setGlobalPrefix('api/v1');

  // Security headers via Helmet
  app.use(helmet());
  app.use(helmet.hsts({ maxAge: 31536000, includeSubDomains: true, preload: true }));
  app.use(helmet.referrerPolicy({ policy: 'strict-origin-when-cross-origin' }));

  // Structured logging
  const logger = app.get(LoggingService);
  app.useLogger(logger);

  // Global exception filter - sanitizes errors in production
  app.useGlobalFilters(new GlobalExceptionFilter(logger, environment.NODE_ENV));

  // Global validation pipe - strips unknown properties, forbids non-whitelisted
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: true },
    }),
  );

  // Restrictive CORS - only configured origins
  app.enableCors({
    origin: environment.CORS_ORIGINS.split(',').map((origin: string) => origin.trim()),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Installation-Secret', 'X-Signature'],
    credentials: false,
    maxAge: 86400,
  });

  // Request size limits
  app.use(express.json({ limit: '100kb' }));
  app.use(express.urlencoded({ extended: true, limit: '100kb' }));

  // Capture raw body for webhook signature verification on payment webhook routes
  app.use('/api/v1/platform/payment-providers/*/webhook', express.raw({ type: '*/*' }));

  // General rate limiting
  app.use(
    rateLimit({
      windowMs: environment.RATE_LIMIT_WINDOW_MS,
      max: environment.RATE_LIMIT_MAX,
      standardHeaders: true,
      legacyHeaders: false,
      message: { error: 'Too many requests, please try again later.' },
    }),
  );

  await app.listen(environment.PORT);
}

void bootstrap();
