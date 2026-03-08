import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { UploadedByRole } from '@prisma/client';
import { AttachmentsService } from './attachments.service';
import {
  signAttachmentUploadTicket,
  verifyAttachmentUploadTicket,
} from './utils/attachment-upload-ticket.util';

describe('AttachmentsService', () => {
  const uploadSecret = 'test-upload-ticket-secret-1234';

  const tx = {
    request: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    requestAttachment: {
      count: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    requestActivityLog: {
      create: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'attachments.uploadTicketSecret') {
        return uploadSecret;
      }

      if (key === 'attachments.uploadTicketTtlSeconds') {
        return 900;
      }

      if (key === 'attachments.downloadUrlTtlSeconds') {
        return 600;
      }

      return undefined;
    }),
  };

  const storageProvider = {
    createUploadPresign: jest.fn(),
    createDownloadPresign: jest.fn(),
  };

  const storageService = {
    getProvider: jest.fn(() => storageProvider),
  };

  const service = new AttachmentsService(
    prisma as never,
    config as never,
    storageService as never,
  );

  const expectErrorCode = async (task: Promise<unknown>, code: string) => {
    try {
      await task;
      fail(`expected error code ${code}`);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(
        (error as Error & { getResponse?: () => unknown }).getResponse?.(),
      ).toMatchObject({
        code,
      });
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    tx.request.findUnique.mockResolvedValue({
      id: 'req-1',
      phone: '+66811111111',
    });

    tx.request.update.mockResolvedValue({ id: 'req-1' });

    tx.requestAttachment.count.mockResolvedValue(0);
    tx.requestAttachment.findFirst.mockResolvedValue(null);
    tx.requestAttachment.create.mockResolvedValue({
      id: 'att-1',
      requestId: 'req-1',
      fileKind: 'DOCUMENT',
      fileName: 'doc.pdf',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storageKey: 'requests/req-1/doc.pdf',
      publicUrl: null,
      uploadedByRole: UploadedByRole.ADMIN,
      createdAt: new Date('2030-01-01T00:00:00.000Z'),
    });

    tx.requestActivityLog.create.mockResolvedValue({ id: 'log-1' });

    storageProvider.createUploadPresign.mockResolvedValue({
      url: 'https://upload.example/put',
      method: 'PUT',
      headers: { 'content-type': 'application/pdf' },
      expiresAt: new Date('2030-01-01T00:15:00.000Z'),
    });

    storageProvider.createDownloadPresign.mockResolvedValue({
      url: 'https://download.example/get',
      expiresAt: new Date('2030-01-01T00:10:00.000Z'),
    });
  });

  it('issues admin upload ticket with signed token and storage presign', async () => {
    const result = await service.issueAdminUploadTicket('req-1', {
      fileKind: 'DOCUMENT',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
    });

    expect(result).toMatchObject({
      storageKey: expect.stringContaining('requests/req-1/'),
      uploadUrl: 'https://upload.example/put',
      uploadMethod: 'PUT',
      uploadHeaders: { 'content-type': 'application/pdf' },
    });

    const payload = verifyAttachmentUploadTicket(
      result.uploadToken,
      uploadSecret,
    );
    expect(payload).toMatchObject({
      requestId: 'req-1',
      fileKind: 'DOCUMENT',
      fileName: 'invoice.pdf',
      mimeType: 'application/pdf',
      fileSize: 2048,
      uploadedByRole: UploadedByRole.ADMIN,
    });

    expect(storageProvider.createUploadPresign).toHaveBeenCalledTimes(1);
  });

  it('rejects issue upload ticket when mime type is invalid for file kind', async () => {
    await expectErrorCode(
      service.issueAdminUploadTicket('req-1', {
        fileKind: 'DOCUMENT',
        fileName: 'photo.png',
        mimeType: 'image/png',
        fileSize: 1024,
      }),
      'INVALID_ATTACHMENT_MIME_TYPE',
    );
  });

  it('rejects issue upload ticket when attachment count exceeds limit', async () => {
    tx.requestAttachment.count.mockResolvedValue(10);

    await expectErrorCode(
      service.issueAdminUploadTicket('req-1', {
        fileKind: 'DOCUMENT',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
      }),
      'ATTACHMENT_COUNT_LIMIT_EXCEEDED',
    );
  });

  it('rejects complete upload when token is invalid', async () => {
    await expectErrorCode(
      service.completeAdminUpload('req-1', { uploadToken: 'invalid-token' }),
      'INVALID_ATTACHMENT_UPLOAD_TOKEN',
    );
  });

  it('rejects complete upload when token role mismatches actor role', async () => {
    const uploadToken = signAttachmentUploadTicket(
      {
        requestId: 'req-1',
        storageKey: 'requests/req-1/file.pdf',
        fileKind: 'DOCUMENT',
        fileName: 'file.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        uploadedByRole: UploadedByRole.EMPLOYEE,
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      uploadSecret,
    );

    await expectErrorCode(
      service.completeAdminUpload('req-1', { uploadToken }),
      'ATTACHMENT_UPLOAD_TOKEN_ROLE_MISMATCH',
    );
  });

  it('completes admin upload and writes attachment + activity log', async () => {
    const uploadToken = signAttachmentUploadTicket(
      {
        requestId: 'req-1',
        storageKey: 'requests/req-1/doc.pdf',
        fileKind: 'DOCUMENT',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        uploadedByRole: UploadedByRole.ADMIN,
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      uploadSecret,
    );

    const result = await service.completeAdminUpload('req-1', { uploadToken });

    expect(result).toMatchObject({
      id: 'att-1',
      requestId: 'req-1',
      fileName: 'doc.pdf',
      uploadedByRole: UploadedByRole.ADMIN,
    });

    expect(tx.requestActivityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: 'req-1',
        action: 'UPLOAD_ATTACHMENT',
        actorRole: 'ADMIN',
        note: 'doc.pdf',
      }),
    });

    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: { latestActivityAt: expect.any(Date) },
      select: { id: true },
    });
  });

  it('rejects employee download when request is owned by another phone', async () => {
    tx.request.findUnique.mockResolvedValue({
      id: 'req-1',
      phone: '+66819999999',
    });

    try {
      await service.getEmployeeDownloadUrl('req-1', 'att-1', '+66811111111');
      fail('expected getEmployeeDownloadUrl to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(ForbiddenException);
      expect((error as ForbiddenException).getResponse()).toMatchObject({
        code: 'FORBIDDEN',
      });
    }

    expect(tx.requestAttachment.findFirst).not.toHaveBeenCalled();
  });

  it('returns admin download URL when attachment exists', async () => {
    tx.requestAttachment.findFirst.mockResolvedValue({
      id: 'att-1',
      fileName: 'doc.pdf',
      fileKind: 'DOCUMENT',
      mimeType: 'application/pdf',
      fileSize: 1024,
      storageKey: 'requests/req-1/doc.pdf',
    });

    const result = await service.getAdminDownloadUrl('req-1', 'att-1');

    expect(result).toMatchObject({
      attachmentId: 'att-1',
      fileName: 'doc.pdf',
      downloadUrl: 'https://download.example/get',
    });
  });

  it('returns not found when admin requests missing attachment download URL', async () => {
    tx.requestAttachment.findFirst.mockResolvedValue(null);

    try {
      await service.getAdminDownloadUrl('req-1', 'att-missing');
      fail('expected getAdminDownloadUrl to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(NotFoundException);
      expect((error as NotFoundException).getResponse()).toMatchObject({
        code: 'ATTACHMENT_NOT_FOUND',
      });
    }
  });

  it('rejects duplicate storage key during complete upload', async () => {
    const uploadToken = signAttachmentUploadTicket(
      {
        requestId: 'req-1',
        storageKey: 'requests/req-1/doc.pdf',
        fileKind: 'DOCUMENT',
        fileName: 'doc.pdf',
        mimeType: 'application/pdf',
        fileSize: 1024,
        uploadedByRole: UploadedByRole.ADMIN,
        exp: Math.floor(Date.now() / 1000) + 60,
      },
      uploadSecret,
    );

    tx.requestAttachment.findFirst.mockResolvedValue({ id: 'att-existing' });

    await expectErrorCode(
      service.completeAdminUpload('req-1', { uploadToken }),
      'DUPLICATE_ATTACHMENT_STORAGE_KEY',
    );
  });
});
