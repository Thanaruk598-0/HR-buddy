import { BadRequestException } from '@nestjs/common';
import { FileKind } from '@prisma/client';

const MAX_ATTACHMENTS_PER_REQUEST = 10;

const FILE_POLICY: Record<
  FileKind,
  { maxSize: number; allowedMimeTypes: string[] }
> = {
  IMAGE: {
    maxSize: 10 * 1024 * 1024,
    allowedMimeTypes: [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
      'image/gif',
      'image/heic',
      'image/heif',
    ],
  },
  VIDEO: {
    maxSize: 100 * 1024 * 1024,
    allowedMimeTypes: [
      'video/mp4',
      'video/quicktime',
      'video/webm',
      'video/x-msvideo',
      'video/mpeg',
    ],
  },
  DOCUMENT: {
    maxSize: 20 * 1024 * 1024,
    allowedMimeTypes: [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'application/rtf',
      'application/zip',
      'application/x-zip-compressed',
      'text/plain',
      'text/csv',
      'application/csv',
    ],
  },
};

export function assertAttachmentPolicy(params: {
  fileKind: FileKind;
  mimeType: string;
  fileSize: number;
}) {
  const { fileKind, mimeType, fileSize } = params;

  const policy = FILE_POLICY[fileKind];

  if (!policy.allowedMimeTypes.includes(mimeType)) {
    throw new BadRequestException({
      code: 'INVALID_ATTACHMENT_MIME_TYPE',
      message: `mimeType ${mimeType} is not allowed for fileKind ${fileKind}`,
    });
  }

  if (fileSize > policy.maxSize) {
    throw new BadRequestException({
      code: 'ATTACHMENT_FILE_TOO_LARGE',
      message: `fileSize exceeds limit for fileKind ${fileKind}`,
    });
  }
}

export function assertAttachmentCountLimit(currentCount: number) {
  if (currentCount >= MAX_ATTACHMENTS_PER_REQUEST) {
    throw new BadRequestException({
      code: 'ATTACHMENT_COUNT_LIMIT_EXCEEDED',
      message: `Maximum ${MAX_ATTACHMENTS_PER_REQUEST} attachments per request`,
    });
  }
}

export function attachmentCountLimit() {
  return MAX_ATTACHMENTS_PER_REQUEST;
}
