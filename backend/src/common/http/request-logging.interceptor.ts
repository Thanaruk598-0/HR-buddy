import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestLoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { requestId?: string }>();
    const res = http.getResponse<Response>();

    const startAt = process.hrtime.bigint();

    return next.handle().pipe(
      finalize(() => {
        const durationMs =
          Number(process.hrtime.bigint() - startAt) / 1_000_000;

        this.logger.log(
          JSON.stringify({
            event: 'http_request',
            requestId: req.requestId ?? null,
            method: req.method,
            path: req.originalUrl ?? req.url,
            statusCode: res.statusCode,
            durationMs: Number(durationMs.toFixed(2)),
            ip: req.ip,
            userAgent: req.get('user-agent') ?? null,
          }),
        );
      }),
    );
  }
}
