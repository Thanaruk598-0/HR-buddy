import { FileKind, UploadedByRole } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';

export type AttachmentUploadTicketPayload = {
  requestId: string;
  storageKey: string;
  fileKind: FileKind;
  fileName: string;
  mimeType: string;
  fileSize: number;
  uploadedByRole: UploadedByRole;
  exp: number;
};

export function signAttachmentUploadTicket(
  payload: AttachmentUploadTicketPayload,
  secret: string,
): string {
  const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString(
    'base64url',
  );
  const signature = createSignature(encodedPayload, secret);

  return `${encodedPayload}.${signature}`;
}

export function verifyAttachmentUploadTicket(
  token: string,
  secret: string,
): AttachmentUploadTicketPayload | null {
  const parts = token.split('.');

  if (parts.length !== 2) {
    return null;
  }

  const [encodedPayload, signature] = parts;
  const expectedSignature = createSignature(encodedPayload, secret);

  const actualBuffer = Buffer.from(signature, 'utf8');
  const expectedBuffer = Buffer.from(expectedSignature, 'utf8');

  if (actualBuffer.length !== expectedBuffer.length) {
    return null;
  }

  if (!timingSafeEqual(actualBuffer, expectedBuffer)) {
    return null;
  }

  try {
    const raw = JSON.parse(
      Buffer.from(encodedPayload, 'base64url').toString('utf8'),
    ) as Partial<AttachmentUploadTicketPayload>;

    if (
      typeof raw.requestId !== 'string' ||
      typeof raw.storageKey !== 'string' ||
      typeof raw.fileKind !== 'string' ||
      typeof raw.fileName !== 'string' ||
      typeof raw.mimeType !== 'string' ||
      typeof raw.fileSize !== 'number' ||
      typeof raw.uploadedByRole !== 'string' ||
      typeof raw.exp !== 'number'
    ) {
      return null;
    }

    return raw as AttachmentUploadTicketPayload;
  } catch {
    return null;
  }
}

function createSignature(value: string, secret: string): string {
  return createHmac('sha256', secret).update(value).digest('base64url');
}
