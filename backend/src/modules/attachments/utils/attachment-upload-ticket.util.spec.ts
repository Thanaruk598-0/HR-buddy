import { FileKind, UploadedByRole } from '@prisma/client';
import {
  signAttachmentUploadTicket,
  verifyAttachmentUploadTicket,
} from './attachment-upload-ticket.util';

describe('attachment-upload-ticket.util', () => {
  const secret = 'test-secret-1234567890';

  const payload = {
    requestId: 'req-1',
    storageKey: 'requests/req-1/file.pdf',
    fileKind: FileKind.DOCUMENT,
    fileName: 'file.pdf',
    mimeType: 'application/pdf',
    fileSize: 100,
    uploadedByRole: UploadedByRole.EMPLOYEE,
    exp: Math.floor(Date.now() / 1000) + 60,
  };

  it('signs and verifies ticket', () => {
    const token = signAttachmentUploadTicket(payload, secret);
    const verified = verifyAttachmentUploadTicket(token, secret);

    expect(verified).toEqual(payload);
  });

  it('returns null for tampered token', () => {
    const token = signAttachmentUploadTicket(payload, secret);
    const tampered = `${token}tampered`;

    expect(verifyAttachmentUploadTicket(tampered, secret)).toBeNull();
  });

  it('returns null for malformed token', () => {
    expect(verifyAttachmentUploadTicket('invalid', secret)).toBeNull();
  });
});
