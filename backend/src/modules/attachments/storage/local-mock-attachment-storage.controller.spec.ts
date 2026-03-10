import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LocalMockAttachmentStorageController } from './local-mock-attachment-storage.controller';
import { LocalMockAttachmentStorageService } from './local-mock-attachment-storage.service';
import { createLocalMockPresignSignature } from './local-mock-presign-signature.util';

describe('LocalMockAttachmentStorageController', () => {
  const secret = 'local-mock-controller-secret-1234567890';

  const configValues: Record<string, unknown> = {
    runtimeEnv: 'development',
    'attachments.storage.provider': 'local',
    'attachments.uploadTicketSecret': secret,
    'attachments.storage.localMock.maxUploadBytes': 1024,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  const localMockStorageService = {
    putObject: jest.fn(),
    getObject: jest.fn(),
  } as unknown as LocalMockAttachmentStorageService;

  let controller: LocalMockAttachmentStorageController;

  beforeEach(() => {
    jest.clearAllMocks();
    configValues.runtimeEnv = 'development';
    controller = new LocalMockAttachmentStorageController(
      config,
      localMockStorageService,
    );
  });

  const makeSignature = (expiresAtIso: string, storageKey: string) =>
    createLocalMockPresignSignature({
      action: 'upload',
      storageKey,
      expiresAtIso,
      secret,
    });

  const makeRequest = (ip: string, body: Buffer) =>
    ({
      body,
      headers: {
        'content-type': 'application/pdf',
        'content-length': String(body.length),
      },
      ip,
      socket: { remoteAddress: ip },
    }) as never;

  it('accepts signed upload from loopback client', async () => {
    const storageKey = 'requests/req-1/file.pdf';
    const expiresAtIso = new Date(Date.now() + 60_000).toISOString();

    const result = await controller.upload(
      encodeURIComponent(storageKey),
      expiresAtIso,
      makeSignature(expiresAtIso, storageKey),
      makeRequest('127.0.0.1', Buffer.from('abc')),
    );

    expect(result).toMatchObject({
      ok: true,
      storageKey,
      contentLength: 3,
      contentType: 'application/pdf',
    });

    expect(localMockStorageService.putObject).toHaveBeenCalledWith({
      storageKey,
      content: Buffer.from('abc'),
      contentType: 'application/pdf',
    });
  });

  it('rejects upload when signature is invalid', async () => {
    const storageKey = 'requests/req-1/file.pdf';
    const expiresAtIso = new Date(Date.now() + 60_000).toISOString();

    await expect(
      controller.upload(
        encodeURIComponent(storageKey),
        expiresAtIso,
        'invalid-signature',
        makeRequest('127.0.0.1', Buffer.from('abc')),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects upload when request is not from loopback ip', async () => {
    const storageKey = 'requests/req-1/file.pdf';
    const expiresAtIso = new Date(Date.now() + 60_000).toISOString();

    await expect(
      controller.upload(
        encodeURIComponent(storageKey),
        expiresAtIso,
        makeSignature(expiresAtIso, storageKey),
        makeRequest('203.0.113.10', Buffer.from('abc')),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects upload when runtime environment is production', async () => {
    configValues.runtimeEnv = 'production';

    const storageKey = 'requests/req-1/file.pdf';
    const expiresAtIso = new Date(Date.now() + 60_000).toISOString();

    await expect(
      controller.upload(
        encodeURIComponent(storageKey),
        expiresAtIso,
        makeSignature(expiresAtIso, storageKey),
        makeRequest('127.0.0.1', Buffer.from('abc')),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    configValues.runtimeEnv = 'development';
  });

  it('rejects upload when local mock endpoint is disabled', async () => {
    configValues['attachments.storage.provider'] = 'b2';

    const storageKey = 'requests/req-1/file.pdf';
    const expiresAtIso = new Date(Date.now() + 60_000).toISOString();

    await expect(
      controller.upload(
        encodeURIComponent(storageKey),
        expiresAtIso,
        makeSignature(expiresAtIso, storageKey),
        makeRequest('127.0.0.1', Buffer.from('abc')),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);

    configValues['attachments.storage.provider'] = 'local';
  });
});
