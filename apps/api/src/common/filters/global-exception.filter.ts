import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { LoggingService } from '../../logging/logging.service';

/**
 * Global exception filter.
 *
 * In production, error responses never leak stack traces or internal details.
 * Only the HTTP status code and a generic error message are returned.
 * All exceptions are logged server-side with full context for investigation.
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);
  private readonly isProduction = process.env.NODE_ENV === 'production';

  constructor(private readonly loggingService: LoggingService) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();

    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : 500;

    const isClientError = status >= 400 && status < 500;

    // Log server errors with full details
    if (!isClientError) {
      const errorMessage = exception instanceof Error ? exception.message : String(exception);
      this.loggingService.error(
        `Unhandled exception: ${errorMessage}`,
        `${request.method} ${request.url}`,
      );
    } else {
      this.loggingService.warn(
        `Client error ${status}: ${request.method} ${request.url}`,
        `${request.method} ${request.url}`,
      );
    }

    const isProduction = this.isProduction;

    let errorBody: { statusCode: number; message: string; error?: string };
    if (isHttpException) {
      const responseObj = exception.getResponse();
      const message =
        typeof responseObj === 'string'
          ? responseObj
          : (responseObj as { message?: string }).message ?? 'An error occurred.';
      errorBody = {
        statusCode: status,
        message: isProduction ? this.sanitizeMessage(message) : message,
      };
      if (!isProduction && (responseObj as { error?: string }).error) {
        errorBody.error = (responseObj as { error?: string }).error;
      }
    } else {
      errorBody = {
        statusCode: status,
        message: isProduction ? 'Internal server error.' : String(exception),
      };
    }

    response.status(status).json(errorBody);
  }

  private sanitizeMessage(message: string): string {
    // Strip common internal leakage patterns from production messages
    return message
      .replace(/at Object\.<anonymous>.*/g, '')
      .replace(/\\n/g, ' ')
      .replace(/Error: /g, '')
      .trim() || 'An error occurred.';
  }
}
