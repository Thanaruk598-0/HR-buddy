import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttachmentDownloadPresign,
  AttachmentObjectMetadata,
  AttachmentStorageProvider,
  AttachmentUploadPresign,
} from './attachment-storage.interface';
import { LocalMockAttachmentStorageService } from './local-mock-attachment-storage.service';

@Injectable()
export class LocalAttachmentStorageProvider implements AttachmentStorageProvider {
  constructor(
    private readonly config: ConfigService,
    private readonly localMockStorageService: LocalMockAttachmentStorageService,
  ) {}

  async createUploadPresign(params: {
    storageKey: string;
    mimeType: string;
    fileSize: number;
    expiresAt: Date;
  }): Promise<AttachmentUploadPresign> {
    const base = this.baseUrl();

    return {
      url: `${base}/upload/${encodeURIComponent(params.storageKey)}?expiresAt=${encodeURIComponent(params.expiresAt.toISOString())}`,
      method: 'PUT',
      headers: {
        'content-type': params.mimeType,
        'content-length': String(params.fileSize),
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

  async getObjectMetadata(params: {
    storageKey: string;
  }): Promise<AttachmentObjectMetadata | null> {
    return this.localMockStorageService.getObjectMetadata({
      storageKey: params.storageKey,
    });
  }

  private baseUrl() {
    const raw =
      this.config.get<string>('attachments.storage.baseUrl') ??
      'http://localhost:3001/storage/mock';

    return raw.replace(/\/$/, '');
  }
}
