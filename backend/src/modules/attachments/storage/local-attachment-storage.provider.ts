import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttachmentDownloadPresign,
  AttachmentStorageProvider,
  AttachmentUploadPresign,
} from './attachment-storage.interface';

@Injectable()
export class LocalAttachmentStorageProvider implements AttachmentStorageProvider {
  constructor(private readonly config: ConfigService) {}

  async createUploadPresign(params: {
    storageKey: string;
    mimeType: string;
    expiresAt: Date;
  }): Promise<AttachmentUploadPresign> {
    const base = this.baseUrl();

    return {
      url: `${base}/upload/${encodeURIComponent(params.storageKey)}?expiresAt=${encodeURIComponent(params.expiresAt.toISOString())}`,
      method: 'PUT',
      headers: {
        'content-type': params.mimeType,
      },
      expiresAt: params.expiresAt,
    };
  }

  async createDownloadPresign(params: {
    storageKey: string;
    fileName: string;
    expiresAt: Date;
  }): Promise<AttachmentDownloadPresign> {
    const base = this.baseUrl();

    return {
      url: `${base}/download/${encodeURIComponent(params.storageKey)}?fileName=${encodeURIComponent(params.fileName)}&expiresAt=${encodeURIComponent(params.expiresAt.toISOString())}`,
      expiresAt: params.expiresAt,
    };
  }

  private baseUrl() {
    const raw =
      this.config.get<string>('attachments.storage.baseUrl') ??
      'http://localhost:3001/storage/mock';

    return raw.replace(/\/$/, '');
  }
}
