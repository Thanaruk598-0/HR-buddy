import { Injectable } from '@nestjs/common';
import { AttachmentObjectMetadata } from './attachment-storage.interface';

type StoredAttachmentObject = {
  content: Buffer;
  contentType: string | null;
  contentLength: number;
  uploadedAt: Date;
};

@Injectable()
export class LocalMockAttachmentStorageService {
  private readonly objects = new Map<string, StoredAttachmentObject>();

  putObject(params: {
    storageKey: string;
    content: Buffer;
    contentType: string | null;
  }) {
    const normalizedKey = this.normalizeStorageKey(params.storageKey);

    this.objects.set(normalizedKey, {
      content: params.content,
      contentType: params.contentType,
      contentLength: params.content.length,
      uploadedAt: new Date(),
    });
  }

  getObject(params: { storageKey: string }) {
    const normalizedKey = this.normalizeStorageKey(params.storageKey);
    return this.objects.get(normalizedKey) ?? null;
  }

  getObjectMetadata(params: {
    storageKey: string;
  }): AttachmentObjectMetadata | null {
    const object = this.getObject({
      storageKey: params.storageKey,
    });

    if (!object) {
      return null;
    }

    return {
      contentType: object.contentType,
      contentLength: object.contentLength,
    };
  }

  private normalizeStorageKey(storageKey: string) {
    return storageKey.trim();
  }
}
