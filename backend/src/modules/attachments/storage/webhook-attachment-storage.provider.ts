import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createWebhookHeaders } from '../../../common/security/webhook-signature.util';
import {
  AttachmentDownloadPresign,
  AttachmentObjectMetadata,
  AttachmentStorageProvider,
  AttachmentUploadPresign,
} from './attachment-storage.interface';

type WebhookResponse = {
  url?: string;
  method?: 'PUT' | 'POST';
  headers?: Record<string, string>;
  expiresAt?: string;
  exists?: boolean;
  contentType?: string | null;
  contentLength?: number | null;
};

@Injectable()
export class WebhookAttachmentStorageProvider implements AttachmentStorageProvider {
  private readonly logger = new Logger(WebhookAttachmentStorageProvider.name);

  constructor(private readonly config: ConfigService) {}

  async createUploadPresign(params: {
    storageKey: string;
    mimeType: string;
    fileSize: number;
    expiresAt: Date;
  }): Promise<AttachmentUploadPresign> {
    const response = await this.callWebhook({
      action: 'presign_upload',
      storageKey: params.storageKey,
      mimeType: params.mimeType,
      fileSize: params.fileSize,
      expiresAt: params.expiresAt.toISOString(),
    });

    const url = this.readUrlFromWebhook(response);

    return {
      url,
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
    disposition?: 'attachment' | 'inline';
    expiresAt: Date;
  }): Promise<AttachmentDownloadPresign> {
    const response = await this.callWebhook({
      action: 'presign_download',
      storageKey: params.storageKey,
      fileName: params.fileName,
      disposition: params.disposition ?? 'attachment',
      expiresAt: params.expiresAt.toISOString(),
    });

    const url = this.readUrlFromWebhook(response);

    return {
      url,
      expiresAt: response.expiresAt
        ? new Date(response.expiresAt)
        : params.expiresAt,
    };
  }

  async getObjectMetadata(params: {
    storageKey: string;
  }): Promise<AttachmentObjectMetadata | null> {
    const response = await this.callWebhook({
      action: 'head_object',
      storageKey: params.storageKey,
    });

    if (response.exists === false) {
      return null;
    }

    if (response.exists !== true) {
      throw new ServiceUnavailableException({
        code: 'ATTACHMENT_STORAGE_WEBHOOK_INVALID_RESPONSE',
        message: 'Attachment storage webhook response is invalid',
      });
    }

    return {
      contentType:
        typeof response.contentType === 'string' ? response.contentType : null,
      contentLength:
        typeof response.contentLength === 'number'
          ? response.contentLength
          : null,
    };
  }

  private readUrlFromWebhook(response: WebhookResponse): string {
    if (!response?.url || typeof response.url !== 'string') {
      throw new ServiceUnavailableException({
        code: 'ATTACHMENT_STORAGE_WEBHOOK_INVALID_RESPONSE',
        message: 'Attachment storage webhook response is invalid',
      });
    }

    return response.url;
  }

  private async callWebhook(payload: Record<string, unknown>) {
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
    const signingSecret = this.config.get<string>(
      'attachments.storage.webhookSigningSecret',
    );
    const maxRetries =
      this.config.get<number>('attachments.storage.webhookMaxRetries') ?? 2;
    const retryDelayMs =
      this.config.get<number>('attachments.storage.webhookRetryDelayMs') ?? 200;

    const body = JSON.stringify(payload);

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const attemptNumber = attempt + 1;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: createWebhookHeaders({
            apiKey,
            signingSecret,
            body,
          }),
          body,
          signal: controller.signal,
        });

        if (!response.ok) {
          const shouldRetry =
            this.isRetryableStatus(response.status) && attempt < maxRetries;

          if (shouldRetry) {
            this.logger.warn(
              `Attachment storage webhook failed with status ${response.status}; retrying attempt ${attemptNumber}/${maxRetries + 1}`,
            );

            await this.wait(retryDelayMs * attemptNumber);
            continue;
          }

          throw new ServiceUnavailableException({
            code: 'ATTACHMENT_STORAGE_WEBHOOK_FAILED',
            message:
              'Attachment storage webhook returned a non-success response',
            statusCode: response.status,
          });
        }

        const data = (await response.json()) as WebhookResponse;

        if (!data || typeof data !== 'object') {
          throw new ServiceUnavailableException({
            code: 'ATTACHMENT_STORAGE_WEBHOOK_INVALID_RESPONSE',
            message: 'Attachment storage webhook response is invalid',
          });
        }

        return data;
      } catch (error) {
        if (error instanceof ServiceUnavailableException) {
          throw error;
        }

        const isLastAttempt = attempt >= maxRetries;

        if (!isLastAttempt) {
          this.logger.warn(
            `Attachment storage webhook call failed; retrying attempt ${attemptNumber}/${maxRetries + 1}`,
          );
          await this.wait(retryDelayMs * attemptNumber);
          continue;
        }

        throw new ServiceUnavailableException({
          code: 'ATTACHMENT_STORAGE_WEBHOOK_FAILED',
          message: 'Failed to call attachment storage webhook',
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ServiceUnavailableException({
      code: 'ATTACHMENT_STORAGE_WEBHOOK_FAILED',
      message: 'Failed to call attachment storage webhook',
    });
  }

  private isRetryableStatus(statusCode: number) {
    return statusCode === 429 || statusCode >= 500;
  }

  private async wait(ms: number) {
    if (ms <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
