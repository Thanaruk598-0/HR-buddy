import { BadRequestException } from '@nestjs/common';
import { FileKind } from '@prisma/client';
import {
  assertAttachmentCountLimit,
  assertAttachmentPolicy,
  attachmentCountLimit,
} from './attachment-policy.rules';

describe('attachment-policy rules', () => {
  it.each<[FileKind, string, number]>([
    ['IMAGE', 'image/jpeg', 1024],
    ['VIDEO', 'video/mp4', 1024],
    ['DOCUMENT', 'application/pdf', 1024],
  ])('accepts valid attachment %s %s', (fileKind, mimeType, fileSize) => {
    expect(() =>
      assertAttachmentPolicy({ fileKind, mimeType, fileSize }),
    ).not.toThrow();
  });

  it('rejects invalid mime type', () => {
    expect(() =>
      assertAttachmentPolicy({
        fileKind: 'IMAGE',
        mimeType: 'application/pdf',
        fileSize: 1024,
      }),
    ).toThrow(BadRequestException);
  });

  it('rejects oversize by kind', () => {
    expect(() =>
      assertAttachmentPolicy({
        fileKind: 'DOCUMENT',
        mimeType: 'application/pdf',
        fileSize: 21 * 1024 * 1024,
      }),
    ).toThrow(BadRequestException);
  });

  it('enforces max attachments per request', () => {
    expect(() => assertAttachmentCountLimit(attachmentCountLimit())).toThrow(
      BadRequestException,
    );
  });
});