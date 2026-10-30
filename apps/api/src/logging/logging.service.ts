import {
  Injectable,
  LoggerService,
} from '@nestjs/common';
import { createLogger, format, transports } from 'winston';

const { combine, timestamp, errors, printf } = format;

const logFormat = printf(({ level, message, timestamp: ts, stack, ...meta }) => {
  const entry = {
    timestamp: ts,
    level,
    message,
    ...(stack ? { stack } : {}),
    ...(Object.keys(meta).length ? { meta } : {}),
  };
  return JSON.stringify(entry);
});

@Injectable()
export class LoggingService implements LoggerService {
  private readonly logger = createLogger({
    level: process.env.LOG_LEVEL ?? 'info',
    format: combine(
      errors({ stack: true }),
      timestamp(),
      logFormat,
    ),
    transports: [new transports.Console()],
  });

  log(message: string, context?: string): void {
    this.logger.info(message, { context });
  }

  error(message: string, context?: string, trace?: string): void {
    this.logger.error(message, { context, stack: trace });
  }

  warn(message: string, context?: string): void {
    this.logger.warn(message, { context });
  }

  debug(message: string, context?: string): void {
    this.logger.debug(message, { context });
  }

  verbose(message: string, context?: string): void {
    this.logger.verbose(message, { context });
  }
}
