import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  PayloadTooLargeException,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import { RateLimitPolicy } from '../../../common/security/rate-limit.decorator';
import { LocalMockAttachmentStorageService } from './local-mock-attachment-storage.service';
import { verifyLocalMockPresignSignature } from './local-mock-presign-signature.util';

@RateLimitPolicy('messengerLink')
@Controller('storage/mock')
export class LocalMockAttachmentStorageController {
  constructor(
    private readonly config: ConfigService,
    private readonly localMockStorageService: LocalMockAttachmentStorageService,
  ) {}

  @Put('upload/:storageKey')
  async upload(
    @Param('storageKey') storageKeyParam: string,
    @Query('expiresAt') expiresAtQuery: string | string[] | undefined,
    @Query('signature') signatureQuery: string | string[] | undefined,
    @Req() req: Request,
  ) {
    this.assertMockEndpointEnabled(req);

    const storageKey = this.normalizeStorageKey(storageKeyParam);
    const { expiresAtIso, signature } = this.readPresignQuery(
      expiresAtQuery,
      signatureQuery,
    );

    this.assertPresignValid({
      action: 'upload',
      storageKey,
      expiresAtIso,
      signature,
    });

    const contentType = this.normalizeHeaderValue(req.headers['content-type']);
    const contentLengthHeader = this.parseContentLength(
      this.normalizeHeaderValue(req.headers['content-length']),
    );

    const maxUploadBytes = this.maxUploadBytes();

    if (contentLengthHeader !== null && contentLengthHeader > maxUploadBytes) {
      throw new PayloadTooLargeException({
        code: 'MOCK_ATTACHMENT_TOO_LARGE',
        message: 'Uploaded file exceeds local mock storage size limit',
      });
    }

    const body = await this.readBody(req, maxUploadBytes);

    if (contentLengthHeader !== null && contentLengthHeader !== body.length) {
      throw new BadRequestException({
        code: 'MOCK_ATTACHMENT_CONTENT_LENGTH_MISMATCH',
        message: 'content-length header does not match uploaded bytes',
      });
    }

    this.localMockStorageService.putObject({
      storageKey,
      content: body,
      contentType,
    });

    return {
      ok: true,
      storageKey,
      contentLength: body.length,
      contentType,
    };
  }

  @Get('download/:storageKey')
  download(
    @Param('storageKey') storageKeyParam: string,
    @Query('fileName') fileName: string | undefined,
    @Query('expiresAt') expiresAtQuery: string | string[] | undefined,
    @Query('signature') signatureQuery: string | string[] | undefined,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    this.assertMockEndpointEnabled(req);

    const storageKey = this.normalizeStorageKey(storageKeyParam);
    const { expiresAtIso, signature } = this.readPresignQuery(
      expiresAtQuery,
      signatureQuery,
    );

    this.assertPresignValid({
      action: 'download',
      storageKey,
      expiresAtIso,
      signature,
    });

    const object = this.localMockStorageService.getObject({
      storageKey,
    });

    if (!object) {
      throw new NotFoundException({
        code: 'MOCK_ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found in local mock storage',
      });
    }

    const downloadName = this.sanitizeFileName(fileName ?? 'file');

    res.setHeader(
      'content-type',
      object.contentType ?? 'application/octet-stream',
    );
    res.setHeader(
      'content-disposition',
      `attachment; filename="${downloadName}"`,
    );
    res.send(object.content);
  }

  private async readBody(
    req: Request,
    maxUploadBytes: number,
  ): Promise<Buffer> {
    if (Buffer.isBuffer(req.body)) {
      if (req.body.length > maxUploadBytes) {
        throw new PayloadTooLargeException({
          code: 'MOCK_ATTACHMENT_TOO_LARGE',
          message: 'Uploaded file exceeds local mock storage size limit',
        });
      }

      return req.body;
    }

    if (typeof req.body === 'string') {
      const body = Buffer.from(req.body);

      if (body.length > maxUploadBytes) {
        throw new PayloadTooLargeException({
          code: 'MOCK_ATTACHMENT_TOO_LARGE',
          message: 'Uploaded file exceeds local mock storage size limit',
        });
      }

      return body;
    }

    const chunks: Buffer[] = [];
    let totalBytes = 0;

    for await (const rawChunk of req as AsyncIterable<unknown>) {
      let chunk: Buffer;

      if (Buffer.isBuffer(rawChunk)) {
        chunk = rawChunk;
      } else if (rawChunk instanceof Uint8Array) {
        chunk = Buffer.from(rawChunk);
      } else if (typeof rawChunk === 'string') {
        chunk = Buffer.from(rawChunk);
      } else {
        throw new BadRequestException({
          code: 'MOCK_ATTACHMENT_CHUNK_INVALID',
          message: 'Unsupported request body chunk type',
        });
      }

      totalBytes += chunk.length;

      if (totalBytes > maxUploadBytes) {
        throw new PayloadTooLargeException({
          code: 'MOCK_ATTACHMENT_TOO_LARGE',
          message: 'Uploaded file exceeds local mock storage size limit',
        });
      }

      chunks.push(chunk);
    }

    return Buffer.concat(chunks);
  }

  private normalizeStorageKey(raw: string) {
    const normalized = this.safeDecode(raw).trim();

    if (!normalized) {
      throw new BadRequestException({
        code: 'MOCK_ATTACHMENT_STORAGE_KEY_INVALID',
        message: 'storageKey is required',
      });
    }

    return normalized;
  }

  private readPresignQuery(
    expiresAtRaw: string | string[] | undefined,
    signatureRaw: string | string[] | undefined,
  ) {
    const expiresAtValue = this.normalizeQueryValue(expiresAtRaw);
    const signature = this.normalizeQueryValue(signatureRaw);

    if (!expiresAtValue || !signature) {
      throw new BadRequestException({
        code: 'MOCK_ATTACHMENT_PRESIGN_INVALID',
        message: 'expiresAt and signature are required',
      });
    }

    const expiresAt = new Date(expiresAtValue);

    if (!Number.isFinite(expiresAt.getTime())) {
      throw new BadRequestException({
        code: 'MOCK_ATTACHMENT_PRESIGN_INVALID',
        message: 'expiresAt is invalid',
      });
    }

    return {
      expiresAtIso: expiresAt.toISOString(),
      signature,
    };
  }

  private assertPresignValid(params: {
    action: 'upload' | 'download';
    storageKey: string;
    expiresAtIso: string;
    signature: string;
  }) {
    const expiresAt = new Date(params.expiresAtIso);

    if (expiresAt.getTime() <= Date.now()) {
      throw new BadRequestException({
        code: 'MOCK_ATTACHMENT_PRESIGN_EXPIRED',
        message: 'Presigned URL is expired',
      });
    }

    const isValid = verifyLocalMockPresignSignature({
      action: params.action,
      storageKey: params.storageKey,
      expiresAtIso: params.expiresAtIso,
      signature: params.signature,
      secret: this.presignSecret(),
    });

    if (!isValid) {
      throw new BadRequestException({
        code: 'MOCK_ATTACHMENT_PRESIGN_INVALID',
        message: 'Invalid presigned URL signature',
      });
    }
  }

  private safeDecode(value: string) {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }

  private parseContentLength(value: string | null) {
    if (!value) {
      return null;
    }

    const parsed = parseInt(value, 10);

    if (!Number.isFinite(parsed) || parsed < 0) {
      throw new BadRequestException({
        code: 'MOCK_ATTACHMENT_CONTENT_LENGTH_INVALID',
        message: 'Invalid content-length header',
      });
    }

    return parsed;
  }

  private normalizeHeaderValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    if (typeof value === 'string') {
      return value;
    }

    return null;
  }

  private normalizeQueryValue(value: string | string[] | undefined) {
    if (Array.isArray(value)) {
      return value[0] ?? null;
    }

    if (typeof value === 'string') {
      return value;
    }

    return null;
  }

  private sanitizeFileName(fileName: string) {
    const sanitized = fileName.replace(/[\r\n"]/g, '').trim();
    return sanitized || 'file';
  }

  private assertMockEndpointEnabled(req: Request) {
    const provider =
      this.config.get<string>('attachments.storage.provider') ?? 'local';

    const runtimeEnv = (
      this.config.get<string>('runtimeEnv') ??
      this.config.get<string>('nodeEnv') ??
      ''
    ).toLowerCase();

    if (provider !== 'local' || runtimeEnv === 'production') {
      throw new NotFoundException({
        code: 'MOCK_ATTACHMENT_ENDPOINT_DISABLED',
        message: 'Local mock attachment storage endpoint is disabled',
      });
    }

    const ip = req.socket.remoteAddress || '';

    if (!this.isLoopbackIp(ip)) {
      throw new ForbiddenException({
        code: 'MOCK_ATTACHMENT_FORBIDDEN_ORIGIN',
        message: 'Local mock attachment storage only accepts loopback requests',
      });
    }
  }

  private isLoopbackIp(ip: string) {
    const normalized = ip.trim().toLowerCase();

    return (
      normalized === '127.0.0.1' ||
      normalized === '::1' ||
      normalized === '::ffff:127.0.0.1'
    );
  }

  private maxUploadBytes() {
    const configured = this.config.get<number>(
      'attachments.storage.localMock.maxUploadBytes',
    );

    if (!configured || configured <= 0) {
      return 100 * 1024 * 1024;
    }

    return configured;
  }

  private presignSecret() {
    return (
      this.config.get<string>('attachments.uploadTicketSecret') ??
      'dev-only-change-this-attachment-upload-ticket-secret'
    );
  }
}
