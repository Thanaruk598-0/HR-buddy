import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AttachmentDownloadPresign,
  AttachmentObjectMetadata,
  AttachmentStorageProvider,
  AttachmentUploadPresign,
} from './attachment-storage.interface';
import { LocalMockAttachmentStorageService } from './local-mock-attachment-storage.service';
import { createLocalMockPresignSignature } from './local-mock-presign-signature.util';

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
    const expiresAtIso = params.expiresAt.toISOString();
    const signature = createLocalMockPresignSignature({
      action: 'upload',
      storageKey: params.storageKey,
      expiresAtIso,
      secret: this.presignSecret(),
    });

    return {
      url: `${base}/upload/${encodeURIComponent(params.storageKey)}?expiresAt=${encodeURIComponent(expiresAtIso)}&signature=${encodeURIComponent(signature)}`,
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
    disposition?: 'attachment' | 'inline';
    expiresAt: Date;
  }): Promise<AttachmentDownloadPresign> {
    const base = this.baseUrl();
    const expiresAtIso = params.expiresAt.toISOString();
    const signature = createLocalMockPresignSignature({
      action: 'download',
      storageKey: params.storageKey,
      expiresAtIso,
      secret: this.presignSecret(),
    });

    return {
      url: `${base}/download/${encodeURIComponent(params.storageKey)}?fileName=${encodeURIComponent(params.fileName)}&disposition=${encodeURIComponent(params.disposition ?? 'attachment')}&expiresAt=${encodeURIComponent(expiresAtIso)}&signature=${encodeURIComponent(signature)}`,
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

  private presignSecret() {
    return (
      this.config.get<string>('attachments.uploadTicketSecret') ??
      'dev-only-change-this-attachment-upload-ticket-secret'
    );
  }
}
