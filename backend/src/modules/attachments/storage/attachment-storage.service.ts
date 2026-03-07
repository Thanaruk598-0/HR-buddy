import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AttachmentStorageProvider } from './attachment-storage.interface';
import { LocalAttachmentStorageProvider } from './local-attachment-storage.provider';
import { WebhookAttachmentStorageProvider } from './webhook-attachment-storage.provider';

@Injectable()
export class AttachmentStorageService {
  constructor(
    private readonly config: ConfigService,
    private readonly localProvider: LocalAttachmentStorageProvider,
    private readonly webhookProvider: WebhookAttachmentStorageProvider,
  ) {}

  getProvider(): AttachmentStorageProvider {
    const provider =
      this.config.get<string>('attachments.storage.provider') ?? 'local';

    if (provider === 'webhook') {
      return this.webhookProvider;
    }

    return this.localProvider;
  }
}
