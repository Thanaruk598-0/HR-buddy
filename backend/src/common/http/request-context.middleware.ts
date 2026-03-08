import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { NextFunction, Request, Response } from 'express';

const REQUEST_ID_HEADER = 'x-request-id';
const MAX_REQUEST_ID_LENGTH = 128;

function normalizeIncomingRequestId(value: string | undefined) {
  if (!value) {
    return null;
  }

  const normalized = value.trim();

  if (!normalized) {
    return null;
  }

  if (normalized.length > MAX_REQUEST_ID_LENGTH) {
    return null;
  }

  if (!/^[A-Za-z0-9._:-]+$/.test(normalized)) {
    return null;
  }

  return normalized;
}

@Injectable()
export class RequestContextMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const incoming = req.headers[REQUEST_ID_HEADER];
    const incomingId = Array.isArray(incoming) ? incoming[0] : incoming;

    const requestId = normalizeIncomingRequestId(incomingId) ?? randomUUID();

    (req as Request & { requestId?: string }).requestId = requestId;
    res.setHeader(REQUEST_ID_HEADER, requestId);

    next();
  }
}
