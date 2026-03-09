import { ConfigService } from '@nestjs/config';
import { LocalAttachmentStorageProvider } from './local-attachment-storage.provider';
import { LocalMockAttachmentStorageService } from './local-mock-attachment-storage.service';

describe('LocalAttachmentStorageProvider', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'attachments.storage.baseUrl') {
        return 'http://localhost:3001/storage/mock';
      }

      return undefined;
    }),
  } as unknown as ConfigService;

  const localMockStorageService = {
    getObjectMetadata: jest.fn(),
  } as unknown as LocalMockAttachmentStorageService;

  let provider: LocalAttachmentStorageProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new LocalAttachmentStorageProvider(
      config,
      localMockStorageService,
    );
  });

  it('creates upload presign with content length and type headers', async () => {
    const expiresAt = new Date('2030-01-01T00:10:00.000Z');

    const presign = await provider.createUploadPresign({
      storageKey: 'requests/req-1/file.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      expiresAt,
    });

    expect(presign).toMatchObject({
      method: 'PUT',
      expiresAt,
      headers: {
        'content-type': 'application/pdf',
        'content-length': '1024',
      },
    });
    expect(presign.url).toContain('/storage/mock/upload/');
  });

  it('reads metadata from local mock storage state', async () => {
    (localMockStorageService.getObjectMetadata as jest.Mock).mockReturnValue({
      contentType: 'application/pdf',
      contentLength: 1024,
    });

    await expect(
      provider.getObjectMetadata({
        storageKey: 'requests/req-1/file.pdf',
      }),
    ).resolves.toEqual({
      contentType: 'application/pdf',
      contentLength: 1024,
    });

    expect(localMockStorageService.getObjectMetadata).toHaveBeenCalledWith({
      storageKey: 'requests/req-1/file.pdf',
    });
  });
});
