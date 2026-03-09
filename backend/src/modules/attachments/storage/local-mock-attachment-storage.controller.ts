import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { LocalMockAttachmentStorageService } from './local-mock-attachment-storage.service';

@Controller('storage/mock')
export class LocalMockAttachmentStorageController {
  constructor(
    private readonly localMockStorageService: LocalMockAttachmentStorageService,
  ) {}

  @Put('upload/:storageKey')
  async upload(
    @Param('storageKey') storageKeyParam: string,
    @Req() req: Request,
  ) {
    const storageKey = this.normalizeStorageKey(storageKeyParam);
    const body = await this.readBody(req);

    const contentType = this.normalizeHeaderValue(req.headers['content-type']);
    const contentLengthHeader = this.parseContentLength(
      this.normalizeHeaderValue(req.headers['content-length']),
    );

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
    @Res() res: Response,
  ) {
    const storageKey = this.normalizeStorageKey(storageKeyParam);
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

  private async readBody(req: Request): Promise<Buffer> {
    if (Buffer.isBuffer(req.body)) {
      return req.body;
    }

    if (typeof req.body === 'string') {
      return Buffer.from(req.body);
    }

    const chunks: Buffer[] = [];

    for await (const rawChunk of req as AsyncIterable<unknown>) {
      if (Buffer.isBuffer(rawChunk)) {
        chunks.push(rawChunk);
        continue;
      }

      if (rawChunk instanceof Uint8Array) {
        chunks.push(Buffer.from(rawChunk));
        continue;
      }

      if (typeof rawChunk === 'string') {
        chunks.push(Buffer.from(rawChunk));
        continue;
      }

      throw new BadRequestException({
        code: 'MOCK_ATTACHMENT_CHUNK_INVALID',
        message: 'Unsupported request body chunk type',
      });
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

  private sanitizeFileName(fileName: string) {
    const sanitized = fileName.replace(/[\r\n"]/g, '').trim();
    return sanitized || 'file';
  }
}
