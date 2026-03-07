import { ConfigService } from '@nestjs/config';
import { AttachmentStorageService } from './attachment-storage.service';
import { LocalAttachmentStorageProvider } from './local-attachment-storage.provider';
import { WebhookAttachmentStorageProvider } from './webhook-attachment-storage.provider';

describe('AttachmentStorageService', () => {
  it('returns webhook provider when configured', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'attachments.storage.provider' ? 'webhook' : undefined,
      ),
    } as unknown as ConfigService;

    const localProvider = {} as LocalAttachmentStorageProvider;
    const webhookProvider = {} as WebhookAttachmentStorageProvider;

    const service = new AttachmentStorageService(
      config,
      localProvider,
      webhookProvider,
    );

    expect(service.getProvider()).toBe(webhookProvider);
  });

  it('falls back to local provider', () => {
    const config = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const localProvider = {} as LocalAttachmentStorageProvider;
    const webhookProvider = {} as WebhookAttachmentStorageProvider;

    const service = new AttachmentStorageService(
      config,
      localProvider,
      webhookProvider,
    );

    expect(service.getProvider()).toBe(localProvider);
  });
});
