import { Controller, Get } from '@nestjs/common';
import { ApiResponseSchema } from '../common/openapi/response-schema.decorator';
import { healthResponseSchema } from '../common/openapi/response-schemas';
import { PrismaService } from '../database/prisma.service';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiResponseSchema(200, healthResponseSchema)
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        timestamp: new Date().toISOString(),
        database: 'connected',
      };
    } catch {
      return {
        status: 'degraded',
        timestamp: new Date().toISOString(),
        database: 'disconnected',
      };
    }
  }
}
