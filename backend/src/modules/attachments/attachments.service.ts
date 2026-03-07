import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityAction,
  ActorRole,
  Prisma,
  UploadedByRole,
} from '@prisma/client';
import { randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { CompleteAttachmentUploadDto } from './dto/complete-attachment-upload.dto';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import { CreateAttachmentUploadTicketDto } from './dto/create-attachment-upload-ticket.dto';
import {
  assertAttachmentCountLimit,
  assertAttachmentPolicy,
} from './rules/attachment-policy.rules';
import { AttachmentStorageService } from './storage/attachment-storage.service';
import {
  signAttachmentUploadTicket,
  verifyAttachmentUploadTicket,
} from './utils/attachment-upload-ticket.util';

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly storageService: AttachmentStorageService,
  ) {}

  async addEmployeeAttachment(
    requestId: string,
    phone: string,
    dto: CreateAttachmentDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertEmployeeRequestAccess(tx, requestId, phone);

      return this.createAttachment(
        tx,
        requestId,
        dto,
        UploadedByRole.EMPLOYEE,
        ActorRole.EMPLOYEE,
      );
    });
  }

  async addAdminAttachment(requestId: string, dto: CreateAttachmentDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertRequestExists(tx, requestId);

      return this.createAttachment(
        tx,
        requestId,
        dto,
        UploadedByRole.ADMIN,
        ActorRole.ADMIN,
      );
    });
  }

  async issueEmployeeUploadTicket(
    requestId: string,
    phone: string,
    dto: CreateAttachmentUploadTicketDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertEmployeeRequestAccess(tx, requestId, phone);

      return this.issueUploadTicket(
        tx,
        requestId,
        dto,
        UploadedByRole.EMPLOYEE,
      );
    });
  }

  async issueAdminUploadTicket(
    requestId: string,
    dto: CreateAttachmentUploadTicketDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertRequestExists(tx, requestId);

      return this.issueUploadTicket(tx, requestId, dto, UploadedByRole.ADMIN);
    });
  }

  async completeEmployeeUpload(
    requestId: string,
    phone: string,
    dto: CompleteAttachmentUploadDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertEmployeeRequestAccess(tx, requestId, phone);

      return this.completeUpload(
        tx,
        requestId,
        dto.uploadToken,
        UploadedByRole.EMPLOYEE,
        ActorRole.EMPLOYEE,
      );
    });
  }

  async completeAdminUpload(requestId: string, dto: CompleteAttachmentUploadDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertRequestExists(tx, requestId);

      return this.completeUpload(
        tx,
        requestId,
        dto.uploadToken,
        UploadedByRole.ADMIN,
        ActorRole.ADMIN,
      );
    });
  }

  async getEmployeeDownloadUrl(
    requestId: string,
    attachmentId: string,
    phone: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertEmployeeRequestAccess(tx, requestId, phone);

      return this.createDownloadUrl(tx, requestId, attachmentId);
    });
  }

  async getAdminDownloadUrl(requestId: string, attachmentId: string) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertRequestExists(tx, requestId);

      return this.createDownloadUrl(tx, requestId, attachmentId);
    });
  }

  private async issueUploadTicket(
    tx: Prisma.TransactionClient,
    requestId: string,
    dto: CreateAttachmentUploadTicketDto,
    uploadedByRole: UploadedByRole,
  ) {
    assertAttachmentPolicy({
      fileKind: dto.fileKind,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
    });

    const currentCount = await tx.requestAttachment.count({
      where: { requestId },
    });

    assertAttachmentCountLimit(currentCount);

    const expiresAt = this.secondsFromNow(this.uploadTicketTtlSeconds());
    const storageKey = this.generateStorageKey(requestId, dto.fileName);

    const presign = await this.storageService.getProvider().createUploadPresign({
      storageKey,
      mimeType: dto.mimeType,
      expiresAt,
    });

    const uploadToken = signAttachmentUploadTicket(
      {
        requestId,
        storageKey,
        fileKind: dto.fileKind,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        uploadedByRole,
        exp: Math.floor(expiresAt.getTime() / 1000),
      },
      this.uploadTicketSecret(),
    );

    return {
      uploadToken,
      storageKey,
      uploadUrl: presign.url,
      uploadMethod: presign.method,
      uploadHeaders: presign.headers ?? {},
      expiresAt: presign.expiresAt,
    };
  }

  private async completeUpload(
    tx: Prisma.TransactionClient,
    requestId: string,
    uploadToken: string,
    uploadedByRole: UploadedByRole,
    actorRole: ActorRole,
  ) {
    const ticket = verifyAttachmentUploadTicket(
      uploadToken,
      this.uploadTicketSecret(),
    );

    if (!ticket) {
      throw new BadRequestException({
        code: 'INVALID_ATTACHMENT_UPLOAD_TOKEN',
        message: 'Invalid upload token',
      });
    }

    const nowSeconds = Math.floor(Date.now() / 1000);

    if (ticket.exp < nowSeconds) {
      throw new BadRequestException({
        code: 'ATTACHMENT_UPLOAD_TOKEN_EXPIRED',
        message: 'Upload token is expired',
      });
    }

    if (ticket.requestId !== requestId) {
      throw new BadRequestException({
        code: 'ATTACHMENT_UPLOAD_TOKEN_REQUEST_MISMATCH',
        message: 'Upload token is not for this request',
      });
    }

    if (ticket.uploadedByRole !== uploadedByRole) {
      throw new BadRequestException({
        code: 'ATTACHMENT_UPLOAD_TOKEN_ROLE_MISMATCH',
        message: 'Upload token is not allowed for this actor',
      });
    }

    return this.createAttachment(
      tx,
      requestId,
      {
        fileKind: ticket.fileKind,
        fileName: ticket.fileName,
        mimeType: ticket.mimeType,
        fileSize: ticket.fileSize,
        storageKey: ticket.storageKey,
      },
      uploadedByRole,
      actorRole,
    );
  }

  private async createDownloadUrl(
    tx: Prisma.TransactionClient,
    requestId: string,
    attachmentId: string,
  ) {
    const attachment = await tx.requestAttachment.findFirst({
      where: {
        id: attachmentId,
        requestId,
      },
      select: {
        id: true,
        fileName: true,
        fileKind: true,
        mimeType: true,
        fileSize: true,
        storageKey: true,
      },
    });

    if (!attachment) {
      throw new NotFoundException({
        code: 'ATTACHMENT_NOT_FOUND',
        message: 'Attachment not found',
      });
    }

    const expiresAt = this.secondsFromNow(this.downloadUrlTtlSeconds());

    const presign = await this.storageService.getProvider().createDownloadPresign({
      storageKey: attachment.storageKey,
      fileName: attachment.fileName,
      expiresAt,
    });

    return {
      attachmentId: attachment.id,
      fileName: attachment.fileName,
      fileKind: attachment.fileKind,
      mimeType: attachment.mimeType,
      fileSize: attachment.fileSize,
      downloadUrl: presign.url,
      expiresAt: presign.expiresAt,
    };
  }

  private async createAttachment(
    tx: Prisma.TransactionClient,
    requestId: string,
    dto: CreateAttachmentDto,
    uploadedByRole: UploadedByRole,
    actorRole: ActorRole,
  ) {
    assertAttachmentPolicy({
      fileKind: dto.fileKind,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
    });

    const currentCount = await tx.requestAttachment.count({
      where: { requestId },
    });

    assertAttachmentCountLimit(currentCount);

    const duplicatedStorage = await tx.requestAttachment.findFirst({
      where: {
        requestId,
        storageKey: dto.storageKey,
      },
      select: { id: true },
    });

    if (duplicatedStorage) {
      throw new BadRequestException({
        code: 'DUPLICATE_ATTACHMENT_STORAGE_KEY',
        message: 'storageKey already exists for this request',
      });
    }

    const now = new Date();

    const attachment = await tx.requestAttachment.create({
      data: {
        requestId,
        fileKind: dto.fileKind,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSize: dto.fileSize,
        storageKey: dto.storageKey,
        publicUrl: dto.publicUrl ?? null,
        uploadedByRole,
      },
      select: {
        id: true,
        requestId: true,
        fileKind: true,
        fileName: true,
        mimeType: true,
        fileSize: true,
        storageKey: true,
        publicUrl: true,
        uploadedByRole: true,
        createdAt: true,
      },
    });

    await tx.requestActivityLog.create({
      data: {
        requestId,
        action: ActivityAction.UPLOAD_ATTACHMENT,
        note: attachment.fileName,
        actorRole,
      },
    });

    await tx.request.update({
      where: { id: requestId },
      data: { latestActivityAt: now },
      select: { id: true },
    });

    return attachment;
  }

  private async assertRequestExists(tx: Prisma.TransactionClient, requestId: string) {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      select: { id: true },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Request not found',
      });
    }
  }

  private async assertEmployeeRequestAccess(
    tx: Prisma.TransactionClient,
    requestId: string,
    phone: string,
  ) {
    const request = await tx.request.findUnique({
      where: { id: requestId },
      select: { id: true, phone: true },
    });

    if (!request) {
      throw new NotFoundException({
        code: 'REQUEST_NOT_FOUND',
        message: 'Request not found',
      });
    }

    if (request.phone !== phone) {
      throw new ForbiddenException({
        code: 'FORBIDDEN',
        message: 'Not your request',
      });
    }
  }

  private uploadTicketSecret() {
    return (
      this.config.get<string>('attachments.uploadTicketSecret') ??
      'dev-only-change-this-attachment-upload-ticket-secret'
    );
  }

  private uploadTicketTtlSeconds() {
    return this.config.get<number>('attachments.uploadTicketTtlSeconds') ?? 900;
  }

  private downloadUrlTtlSeconds() {
    return this.config.get<number>('attachments.downloadUrlTtlSeconds') ?? 900;
  }

  private secondsFromNow(seconds: number) {
    return new Date(Date.now() + seconds * 1000);
  }

  private generateStorageKey(requestId: string, fileName: string): string {
    const safeName = fileName
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .slice(-80);

    const random = randomBytes(8).toString('hex');
    return `requests/${requestId}/${Date.now()}-${random}-${safeName || 'file'}`;
  }
}
