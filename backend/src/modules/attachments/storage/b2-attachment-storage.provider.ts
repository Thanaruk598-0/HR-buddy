import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  HeadObjectCommandOutput,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import {
  AttachmentDownloadPresign,
  AttachmentObjectMetadata,
  AttachmentStorageProvider,
  AttachmentUploadPresign,
} from './attachment-storage.interface';
import { buildContentDispositionHeader } from './content-disposition.util';

@Injectable()
export class B2AttachmentStorageProvider implements AttachmentStorageProvider {
  constructor(private readonly config: ConfigService) {}

  async createUploadPresign(params: {
    storageKey: string;
    mimeType: string;
    fileSize: number;
    expiresAt: Date;
  }): Promise<AttachmentUploadPresign> {
    const { bucketName } = this.readRequiredConfig();
    const expiresIn = this.computeExpiresInSeconds(params.expiresAt);

    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: params.storageKey,
      ContentType: params.mimeType,
      ContentLength: params.fileSize,
    });

    const url = await getSignedUrl(this.createClient(), command, {
      expiresIn,
    });

    return {
      url,
      method: 'PUT',
      headers: {
        'content-type': params.mimeType,
        'content-length': String(params.fileSize),
      },
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async createDownloadPresign(params: {
    storageKey: string;
    fileName: string;
    disposition?: 'attachment' | 'inline';
    expiresAt: Date;
  }): Promise<AttachmentDownloadPresign> {
    const { bucketName } = this.readRequiredConfig();
    const expiresIn = this.computeExpiresInSeconds(params.expiresAt);

    const disposition = params.disposition ?? 'attachment';
    const contentDisposition = buildContentDispositionHeader({
      disposition,
      fileName: params.fileName,
    });

    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: params.storageKey,
      ResponseContentDisposition: contentDisposition,
    });

    const url = await getSignedUrl(this.createClient(), command, {
      expiresIn,
    });

    return {
      url,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    };
  }

  async getObjectMetadata(params: {
    storageKey: string;
  }): Promise<AttachmentObjectMetadata | null> {
    const { bucketName } = this.readRequiredConfig();

    const head = await this.loadHeadObject(bucketName, params.storageKey);

    if (!head) {
      return null;
    }

    return {
      contentType:
        typeof head.ContentType === 'string' ? head.ContentType : null,
      contentLength:
        typeof head.ContentLength === 'number' ? head.ContentLength : null,
    };
  }

  private async loadHeadObject(
    bucketName: string,
    storageKey: string,
  ): Promise<HeadObjectCommandOutput | null> {
    try {
      return await this.createClient().send(
        new HeadObjectCommand({
          Bucket: bucketName,
          Key: storageKey,
        }),
      );
    } catch (error) {
      if (this.isNotFoundError(error)) {
        return null;
      }

      throw new ServiceUnavailableException({
        code: 'ATTACHMENT_B2_OBJECT_CHECK_FAILED',
        message: 'Failed to verify attachment object in B2 storage',
      });
    }
  }

  private createClient() {
    const { endpoint, region, accessKeyId, secretAccessKey } =
      this.readRequiredConfig();

    return new S3Client({
      region,
      endpoint,
      forcePathStyle: true,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });
  }

  private readRequiredConfig() {
    const bucketName =
      this.config.get<string>('attachments.storage.b2.bucketName')?.trim() ??
      '';
    const endpoint =
      this.config.get<string>('attachments.storage.b2.s3Endpoint')?.trim() ??
      '';
    const region =
      this.config.get<string>('attachments.storage.b2.region')?.trim() ||
      'us-west-004';
    const accessKeyId =
      this.config.get<string>('attachments.storage.b2.accessKeyId')?.trim() ??
      '';
    const secretAccessKey =
      this.config
        .get<string>('attachments.storage.b2.secretAccessKey')
        ?.trim() ?? '';

    if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
      throw new ServiceUnavailableException({
        code: 'ATTACHMENT_B2_NOT_CONFIGURED',
        message:
          'B2 storage provider is not fully configured (bucket/endpoint/access key/secret key)',
      });
    }

    return {
      bucketName,
      endpoint,
      region,
      accessKeyId,
      secretAccessKey,
    };
  }

  private computeExpiresInSeconds(target: Date) {
    const maxTtl =
      this.config.get<number>('attachments.storage.b2.maxPresignTtlSeconds') ??
      3600;

    const now = Date.now();
    const diffSeconds = Math.floor((target.getTime() - now) / 1000);

    return Math.min(Math.max(diffSeconds, 1), Math.max(maxTtl, 1));
  }


  private isNotFoundError(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const withName = error as {
      name?: unknown;
      code?: unknown;
      Code?: unknown;
    };
    const name = typeof withName.name === 'string' ? withName.name : '';
    const code =
      typeof withName.code === 'string'
        ? withName.code
        : typeof withName.Code === 'string'
          ? withName.Code
          : '';

    const withMeta = error as {
      $metadata?: {
        httpStatusCode?: unknown;
      };
    };

    const status = withMeta.$metadata?.httpStatusCode;

    return (
      status === 404 ||
      name === 'NotFound' ||
      name === 'NoSuchKey' ||
      code === 'NotFound' ||
      code === 'NoSuchKey'
    );
  }
}
