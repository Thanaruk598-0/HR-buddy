import {
  ArgumentsHost,
  Catch,
  HttpException,
  Logger,
} from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { Request } from 'express';

@Catch()
export class ExceptionLoggingFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(ExceptionLoggingFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {
    super(adapterHost.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    if (host.getType() === 'http') {
      const req = host
        .switchToHttp()
        .getRequest<Request & { requestId?: string }>();

      const statusCode =
        exception instanceof HttpException ? exception.getStatus() : 500;

      if (statusCode >= 500) {
        const responsePayload =
          exception instanceof HttpException ? exception.getResponse() : null;

        const stack = exception instanceof Error ? exception.stack : undefined;

        this.logger.error(
          JSON.stringify({
            event: 'http_exception',
            requestId: req.requestId ?? null,
            method: req.method,
            path: req.originalUrl ?? req.url,
            statusCode,
            message:
              responsePayload ??
              (exception instanceof Error
                ? exception.message
                : 'Unhandled exception'),
          }),
          stack,
        );
      }
    }

    super.catch(exception, host);
  }
}
