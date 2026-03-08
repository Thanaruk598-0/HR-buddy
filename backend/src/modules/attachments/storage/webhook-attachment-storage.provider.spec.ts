import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { WebhookAttachmentStorageProvider } from './webhook-attachment-storage.provider';

describe('WebhookAttachmentStorageProvider', () => {
  const configValues: Record<string, unknown> = {
    'attachments.storage.webhookUrl': 'https://example.com/attachments',
    'attachments.storage.webhookApiKey': 'secret',
    'attachments.storage.webhookTimeoutMs': 5000,
    'attachments.storage.webhookMaxRetries': 2,
    'attachments.storage.webhookRetryDelayMs': 0,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  let provider: WebhookAttachmentStorageProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new WebhookAttachmentStorageProvider(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries on retryable status and succeeds', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ url: 'https://signed.example/upload' }),
      } as Response);

    const result = await provider.createUploadPresign({
      storageKey: 'requests/req-1/file.pdf',
      mimeType: 'application/pdf',
      expiresAt: new Date('2030-01-01T00:10:00.000Z'),
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.url).toBe('https://signed.example/upload');
  });

  it('does not retry on non-retryable status', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response);

    await expect(
      provider.createDownloadPresign({
        storageKey: 'requests/req-1/file.pdf',
        fileName: 'file.pdf',
        expiresAt: new Date('2030-01-01T00:10:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('throws for invalid webhook payload shape', async () => {
    jest.spyOn(global, 'fetch').mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ wrong: true }),
    } as Response);

    await expect(
      provider.createDownloadPresign({
        storageKey: 'requests/req-1/file.pdf',
        fileName: 'file.pdf',
        expiresAt: new Date('2030-01-01T00:10:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('throws when webhook URL is missing', async () => {
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'attachments.storage.webhookUrl') {
        return null;
      }
      return configValues[key];
    });

    await expect(
      provider.createUploadPresign({
        storageKey: 'requests/req-1/file.pdf',
        mimeType: 'application/pdf',
        expiresAt: new Date('2030-01-01T00:10:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
