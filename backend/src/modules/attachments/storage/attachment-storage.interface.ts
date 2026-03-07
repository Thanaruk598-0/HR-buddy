export type AttachmentUploadPresign = {
  url: string;
  method: 'PUT' | 'POST';
  headers?: Record<string, string>;
  expiresAt: Date;
};

export type AttachmentDownloadPresign = {
  url: string;
  expiresAt: Date;
};

export interface AttachmentStorageProvider {
  createUploadPresign(params: {
    storageKey: string;
    mimeType: string;
    expiresAt: Date;
  }): Promise<AttachmentUploadPresign>;

  createDownloadPresign(params: {
    storageKey: string;
    fileName: string;
    expiresAt: Date;
  }): Promise<AttachmentDownloadPresign>;
}
