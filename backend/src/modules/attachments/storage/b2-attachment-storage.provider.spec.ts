import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { B2AttachmentStorageProvider } from './b2-attachment-storage.provider';

jest.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: jest.fn(),
}));

describe('B2AttachmentStorageProvider', () => {
  const getSignedUrlMock = getSignedUrl as jest.MockedFunction<
    typeof getSignedUrl
  >;

  const configValues: Record<string, unknown> = {
    'attachments.storage.b2.bucketName': 'hrbuddy-attachments',
    'attachments.storage.b2.s3Endpoint':
      'https://s3.us-west-004.backblazeb2.com',
    'attachments.storage.b2.region': 'us-west-004',
    'attachments.storage.b2.accessKeyId': 'test-key-id',
    'attachments.storage.b2.secretAccessKey': 'test-secret-key-123456',
    'attachments.storage.b2.maxPresignTtlSeconds': 3600,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  let provider: B2AttachmentStorageProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    (config.get as jest.Mock).mockImplementation(
      (key: string) => configValues[key],
    );
    provider = new B2AttachmentStorageProvider(config);
  });

  it('throws when b2 configuration is incomplete', async () => {
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'attachments.storage.b2.accessKeyId') {
        return '';
      }

      return configValues[key];
    });

    await expect(
      provider.createUploadPresign({
        storageKey: 'requests/req-1/test.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        expiresAt: new Date('2030-01-01T00:10:00.000Z'),
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('creates upload presign using b2 config', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed.example/upload');

    const result = await provider.createUploadPresign({
      storageKey: 'requests/req-1/test.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    expect(result.url).toBe('https://signed.example/upload');
    expect(result.method).toBe('PUT');
    expect(result.headers).toEqual({
      'content-type': 'application/pdf',
      'content-length': '1024',
    });
    expect(getSignedUrlMock).toHaveBeenCalledTimes(1);
  });

  it('sanitizes download filename before generating signed url', async () => {
    getSignedUrlMock.mockResolvedValueOnce('https://signed.example/download');

    await provider.createDownloadPresign({
      storageKey: 'requests/req-1/test.pdf',
      fileName: 'my"\r\nfile.pdf',
      expiresAt: new Date(Date.now() + 10 * 60 * 1000),
    });

    const command = getSignedUrlMock.mock.calls[0][1] as GetObjectCommand;

    expect(command.input.ResponseContentDisposition).toBe(
      `attachment; filename="myfile.pdf"; filename*=UTF-8''myfile.pdf`,
    );
  });

  it('returns object metadata from head object', async () => {
    const sendMock = jest.fn().mockResolvedValue({
      ContentType: 'application/pdf',
      ContentLength: 1024,
    });

    jest
      .spyOn(provider as any, 'createClient')
      .mockReturnValue({ send: sendMock } as any);

    await expect(
      provider.getObjectMetadata({
        storageKey: 'requests/req-1/test.pdf',
      }),
    ).resolves.toEqual({
      contentType: 'application/pdf',
      contentLength: 1024,
    });
  });

  it('returns null metadata when object does not exist', async () => {
    const sendMock = jest.fn().mockRejectedValue({
      $metadata: {
        httpStatusCode: 404,
      },
    });

    jest
      .spyOn(provider as any, 'createClient')
      .mockReturnValue({ send: sendMock } as any);

    await expect(
      provider.getObjectMetadata({
        storageKey: 'requests/req-1/missing.pdf',
      }),
    ).resolves.toBeNull();
  });

  it('throws when head object check fails with unknown error', async () => {
    const sendMock = jest.fn().mockRejectedValue(new Error('boom'));

    jest
      .spyOn(provider as any, 'createClient')
      .mockReturnValue({ send: sendMock } as any);

    await expect(
      provider.getObjectMetadata({
        storageKey: 'requests/req-1/test.pdf',
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

