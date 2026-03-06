import { BadRequestException, NotFoundException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminRequestsQueryDto } from './dto/admin-requests.query.dto';
import {
  AdminRequestDetailResponse,
  AdminRequestListResponse,
} from './admin-requests.types';
import { AdminRequestActionDto } from './dto/admin-request-action.dto';
import { assertValidTransition } from './rules/request-transition.rules';
import { updateSlaOnStatusChange } from './rules/sla.rules';
import { assertDocumentPreconditions } from './rules/document-precondition.rules';
import {
  assertActionNoteRule,
  isTerminalStatus,
  normalizeNote,
} from './rules/request-action.rules';

@Injectable()
export class AdminRequestsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: AdminRequestsQueryDto): Promise<AdminRequestListResponse> {
    const where: Prisma.RequestWhereInput = {};

    if (q.type) where.type = q.type;
    if (q.status) where.status = q.status;

    if (q.dateFrom || q.dateTo) {
      where.createdAt = {};
      if (q.dateFrom) where.createdAt.gte = new Date(q.dateFrom);
      if (q.dateTo) {
        const d = new Date(q.dateTo);
        d.setHours(23, 59, 59, 999);
        where.createdAt.lte = d;
      }
    }

    if (q.q) {
      where.OR = [
        { requestNo: { contains: q.q, mode: 'insensitive' } },
        { phone: { contains: q.q } },
        { employeeName: { contains: q.q, mode: 'insensitive' } },
      ];
    }

    if (q.slaStatus) {
      where.requestSla = { is: { slaStatus: q.slaStatus } };
    }

    const MAX_LIMIT = 200;
    const DEFAULT_LIMIT = 20;
    const DEFAULT_PAGE = 1;

    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const page = q.page ?? DEFAULT_PAGE;

    const skip = (page - 1) * limit;

    const total = await this.prisma.request.count({
      where,
    });

    const items = await this.prisma.request.findMany({
      where,
      orderBy: { latestActivityAt: 'desc' },
      skip,
      take: limit,
      select: {
        id: true,
        requestNo: true,
        type: true,
        status: true,
        urgency: true,
        employeeName: true,
        phone: true,
        departmentId: true,
        createdAt: true,
        latestActivityAt: true,
        closedAt: true,
        requestSla: { select: { slaStatus: true, slaDueAt: true } },
      },
    });

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async detail(id: string): Promise<AdminRequestDetailResponse> {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
        requestSla: true,
        attachments: { orderBy: { createdAt: 'asc' } },
        activityLogs: {
          orderBy: { createdAt: 'asc' },
          include: { operator: true },
        },
        buildingRepairDetail: { include: { problemCategory: true } },
        vehicleRepairDetail: { include: { issueCategory: true } },
        messengerBookingDetail: {
          include: { senderAddress: true, receiverAddress: true },
        },
        documentRequestDetail: {
          include: { deliveryAddress: true, digitalFileAttachment: true },
        },
        magicLink: true,
      },
    });

    if (!req) {
      throw new NotFoundException({
        code: 'NOT_FOUND',
        message: 'Request not found',
      });
    }

    return req;
  }

  async updateStatus(id: string, dto: AdminRequestActionDto) {
    await this.prisma.$transaction(async (tx) => {
      const req = await tx.request.findUnique({
        where: { id },
        select: {
          type: true,
          status: true,
          documentRequestDetail: {
            select: {
              deliveryMethod: true,
              deliveryAddressId: true,
              digitalFileAttachmentId: true,
              pickupNote: true,
            },
          },
        },
      });

      if (!req) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Request not found',
        });
      }

      const operator = await tx.operator.findUnique({
        where: { id: dto.operatorId },
        select: { id: true, isActive: true },
      });

      if (!operator) {
        throw new BadRequestException({
          code: 'INVALID_OPERATOR_ID',
          message: 'Invalid operatorId',
        });
      }

      if (!operator.isActive) {
        throw new BadRequestException({
          code: 'OPERATOR_INACTIVE',
          message: 'operatorId is inactive',
        });
      }

      assertValidTransition(req.type, req.status, dto.status);

      const normalizedNote = normalizeNote(dto.note);
      assertActionNoteRule(dto.status, normalizedNote);

      if (req.type === 'DOCUMENT') {
        const detail = req.documentRequestDetail;

        if (!detail) {
          throw new BadRequestException({
            code: 'DOCUMENT_DETAIL_NOT_FOUND',
            message: 'Document detail not found for this request',
          });
        }

        let nextDigitalFileAttachmentId = detail.digitalFileAttachmentId;
        let nextPickupNote = detail.pickupNote;

        if (dto.digitalFileAttachmentId !== undefined) {
          const attachment = await tx.requestAttachment.findUnique({
            where: { id: dto.digitalFileAttachmentId },
            select: { id: true, requestId: true, fileKind: true },
          });

          if (!attachment || attachment.requestId !== id) {
            throw new BadRequestException({
              code: 'INVALID_DIGITAL_FILE_ATTACHMENT_ID',
              message:
                'digitalFileAttachmentId must refer to an attachment of this request',
            });
          }

          if (attachment.fileKind !== 'DOCUMENT') {
            throw new BadRequestException({
              code: 'DIGITAL_FILE_ATTACHMENT_MUST_BE_DOCUMENT',
              message: 'digitalFileAttachmentId must be a DOCUMENT file kind',
            });
          }

          nextDigitalFileAttachmentId = dto.digitalFileAttachmentId;
        }

        if (dto.pickupNote !== undefined) {
          nextPickupNote = dto.pickupNote.trim() ? dto.pickupNote.trim() : null;
        }

        assertDocumentPreconditions({
          toStatus: dto.status,
          deliveryMethod: detail.deliveryMethod,
          deliveryAddressId: detail.deliveryAddressId,
          digitalFileAttachmentId: nextDigitalFileAttachmentId,
          pickupNote: nextPickupNote,
        });

        if (
          dto.pickupNote !== undefined ||
          dto.digitalFileAttachmentId !== undefined
        ) {
          await tx.documentRequestDetail.update({
            where: { requestId: id },
            data: {
              pickupNote:
                dto.pickupNote !== undefined ? nextPickupNote : undefined,
              digitalFileAttachmentId:
                dto.digitalFileAttachmentId !== undefined
                  ? nextDigitalFileAttachmentId
                  : undefined,
            },
          });
        }
      }

      await tx.request.update({
        where: { id },
        data: {
          status: dto.status,
          latestActivityAt: new Date(),
          closedAt: isTerminalStatus(dto.status) ? new Date() : null,
        },
      });

      await updateSlaOnStatusChange(tx, id, dto.status);

      await tx.requestActivityLog.create({
        data: {
          requestId: id,
          action: 'STATUS_CHANGE',
          fromStatus: req.status,
          toStatus: dto.status,
          actorRole: 'ADMIN',
          operatorId: dto.operatorId,
          note: normalizedNote,
        },
      });
    });
  }
}