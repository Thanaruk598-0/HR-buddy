import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ActivityAction,
  ActorRole,
  Prisma,
  UploadedByRole,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateAttachmentDto } from './dto/create-attachment.dto';
import {
  assertAttachmentCountLimit,
  assertAttachmentPolicy,
} from './rules/attachment-policy.rules';

@Injectable()
export class AttachmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async addEmployeeAttachment(
    requestId: string,
    phone: string,
    dto: CreateAttachmentDto,
  ) {
    return this.prisma.$transaction(async (tx) => {
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

      return this.createAttachment(
        tx,
        requestId,
        dto,
        UploadedByRole.ADMIN,
        ActorRole.ADMIN,
      );
    });
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
}