import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttachmentDownloadPresign,
  AttachmentStorageProvider,
  AttachmentUploadPresign,
} from './attachment-storage.interface';

type WebhookResponse = {
  url?: string;
  method?: 'PUT' | 'POST';
  headers?: Record<string, string>;
  expiresAt?: string;
};

@Injectable()
export class WebhookAttachmentStorageProvider
  implements AttachmentStorageProvider
{
  constructor(private readonly config: ConfigService) {}

  async createUploadPresign(params: {
    storageKey: string;
    mimeType: string;
    expiresAt: Date;
  }): Promise<AttachmentUploadPresign> {
    const response = await this.callWebhook({
      action: 'presign_upload',
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      expiresAt: params.expiresAt.toISOString(),
    });

    return {
      url: response.url,
      method: response.method ?? 'PUT',
      headers: response.headers,
      expiresAt: response.expiresAt
        ? new Date(response.expiresAt)
        : params.expiresAt,
    };
  }

  async createDownloadPresign(params: {
    storageKey: string;
    fileName: string;
    expiresAt: Date;
  }): Promise<AttachmentDownloadPresign> {
    const response = await this.callWebhook({
      action: 'presign_download',
      storageKey: params.storageKey,
      fileName: params.fileName,
      expiresAt: params.expiresAt.toISOString(),
    });

    return {
      url: response.url,
      expiresAt: response.expiresAt
        ? new Date(response.expiresAt)
        : params.expiresAt,
    };
  }

  private async callWebhook(payload: Record<string, unknown>): Promise<Required<Pick<WebhookResponse, 'url'>> & WebhookResponse> {
    const url = this.config.get<string>('attachments.storage.webhookUrl');

    if (!url) {
      throw new ServiceUnavailableException({
        code: 'ATTACHMENT_STORAGE_WEBHOOK_URL_MISSING',
        message: 'Attachment storage webhook URL is not configured',
      });
    }

    const timeoutMs =
      this.config.get<number>('attachments.storage.webhookTimeoutMs') ?? 5000;
    const apiKey = this.config.get<string>('attachments.storage.webhookApiKey');

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ServiceUnavailableException({
          code: 'ATTACHMENT_STORAGE_WEBHOOK_FAILED',
          message: 'Attachment storage webhook returned a non-success response',
          statusCode: response.status,
        });
      }

      const data = (await response.json()) as WebhookResponse;

      if (!data?.url || typeof data.url !== 'string') {
        throw new ServiceUnavailableException({
          code: 'ATTACHMENT_STORAGE_WEBHOOK_INVALID_RESPONSE',
          message: 'Attachment storage webhook response is invalid',
        });
      }

      return data as Required<Pick<WebhookResponse, 'url'>> & WebhookResponse;
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException({
        code: 'ATTACHMENT_STORAGE_WEBHOOK_FAILED',
        message: 'Failed to call attachment storage webhook',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
