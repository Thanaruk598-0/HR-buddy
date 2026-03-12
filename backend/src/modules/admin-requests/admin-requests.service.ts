import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, RequestStatus, RequestType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { MessengerService } from '../messenger/messenger.service';
import { NotificationsService } from '../notifications/notifications.service';
import { buildAdminRequestWhere } from './admin-request-query.builder';
import {
  AdminRequestCsvExportResult,
  AdminRequestDetailResponse,
  AdminRequestListResponse,
  AdminRequestSummaryResponse,
} from './admin-requests.types';
import { AdminRequestActionDto } from './dto/admin-request-action.dto';
import { AdminRequestsExportQueryDto } from './dto/admin-requests-export.query.dto';
import { AdminRequestsQueryDto } from './dto/admin-requests.query.dto';
import { AdminRequestsReportQueryDto } from './dto/admin-requests-report.query.dto';
import { assertDocumentPreconditions } from './rules/document-precondition.rules';
import {
  assertActionNoteRule,
  isTerminalStatus,
  normalizeNote,
} from './rules/request-action.rules';
import { assertValidTransition } from './rules/request-transition.rules';
import { buildCsv } from './utils/csv.util';

const MAX_LIST_LIMIT = 200;
const DEFAULT_LIST_LIMIT = 20;
const DEFAULT_PAGE = 1;
const MAX_EXPORT_LIMIT = 5000;
const DEFAULT_EXPORT_LIMIT = 1000;
type Tx = Prisma.TransactionClient;

@Injectable()
export class AdminRequestsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly messengerService: MessengerService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async list(q: AdminRequestsQueryDto): Promise<AdminRequestListResponse> {
    const where = buildAdminRequestWhere(q);

    const limit = Math.min(q.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const page = q.page ?? DEFAULT_PAGE;
    const skip = (page - 1) * limit;

    const total = await this.prisma.request.count({ where });

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
      },
    });

    return { items, page, limit, total };
  }

  async summary(
    q: AdminRequestsReportQueryDto,
  ): Promise<AdminRequestSummaryResponse> {
    const where = buildAdminRequestWhere(q);

    const rows = await this.prisma.request.findMany({
      where,
      select: {
        status: true,
        type: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const byStatus = Object.values(RequestStatus).reduce(
      (acc, status) => {
        acc[status] = 0;
        return acc;
      },
      {} as Record<RequestStatus, number>,
    );

    const byType = Object.values(RequestType).reduce(
      (acc, type) => {
        acc[type] = 0;
        return acc;
      },
      {} as Record<RequestType, number>,
    );

    const byDayMap = rows.reduce<Record<string, number>>((acc, row) => {
      byStatus[row.status] += 1;
      byType[row.type] += 1;

      const key = row.createdAt.toISOString().slice(0, 10);
      acc[key] = (acc[key] ?? 0) + 1;

      return acc;
    }, {});

    const byDay = Object.entries(byDayMap)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, count]) => ({ date, total: count }));

    return {
      total: rows.length,
      byStatus,
      byType,
      byDay,
    };
  }

  async exportCsv(
    q: AdminRequestsExportQueryDto,
  ): Promise<AdminRequestCsvExportResult> {
    const where = buildAdminRequestWhere(q);
    const limit = Math.min(q.limit ?? DEFAULT_EXPORT_LIMIT, MAX_EXPORT_LIMIT);

    const items = await this.prisma.request.findMany({
      where,
      orderBy: { latestActivityAt: 'desc' },
      take: limit,
      select: {
        requestNo: true,
        type: true,
        status: true,
        urgency: true,
        employeeName: true,
        phone: true,
        department: {
          select: {
            name: true,
          },
        },
        createdAt: true,
        latestActivityAt: true,
        closedAt: true,
      },
    });

    const headers = [
      'requestNo',
      'type',
      'status',
      'urgency',
      'employeeName',
      'phone',
      'department',
      'createdAt',
      'latestActivityAt',
      'closedAt',
    ];

    const rowsForCsv = items.map((item) => [
      item.requestNo,
      item.type,
      item.status,
      item.urgency,
      item.employeeName,
      item.phone,
      item.department.name,
      item.createdAt,
      item.latestActivityAt,
      item.closedAt,
    ]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return {
      fileName: `requests-export-${timestamp}.csv`,
      rowCount: items.length,
      csvContent: buildCsv(headers, rowsForCsv),
    };
  }

  async detail(id: string): Promise<AdminRequestDetailResponse> {
    const req = await this.prisma.request.findUnique({
      where: { id },
      include: {
        department: { select: { id: true, name: true } },
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
    return this.prisma.$transaction(async (tx) => {
      const operatorId = dto.operatorId.trim();
      if (!operatorId) {
        throw new BadRequestException({
          code: 'INVALID_OPERATOR_ID',
          message: 'Invalid operatorId',
        });
      }

      await this.acquireRequestMutationLock(tx, id);

      const req = await tx.request.findUnique({
        where: { id },
        select: {
          type: true,
          status: true,
          requestNo: true,
          phone: true,
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
        where: { id: operatorId },
        select: { id: true, isActive: true, displayName: true },
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

      if (req.type === RequestType.DOCUMENT) {
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

      let magicLinkPayload: { url: string; expiresAt: Date } | null = null;

      if (
        req.type === RequestType.MESSENGER &&
        dto.status === RequestStatus.APPROVED
      ) {
        const generated =
          await this.messengerService.createOrRotateMagicLinkForRequest(tx, id);

        magicLinkPayload = {
          url: generated.url,
          expiresAt: generated.expiresAt,
        };
      }

      await tx.request.update({
        where: { id },
        data: {
          status: dto.status,
          latestActivityAt: new Date(),
          closedAt: isTerminalStatus(dto.status) ? new Date() : null,
        },
      });

      if (req.type === RequestType.MESSENGER && isTerminalStatus(dto.status)) {
        await this.messengerService.revokeMagicLinkForRequest(tx, id);
      }

      await tx.requestActivityLog.create({
        data: {
          requestId: id,
          action: 'STATUS_CHANGE',
          fromStatus: req.status,
          toStatus: dto.status,
          actorRole: 'ADMIN',
          operatorId,
          actorDisplayName: operator.displayName,
          note: normalizedNote,
        },
      });

      await this.notificationsService.notifyEmployeeStatusChange(
        {
          requestId: id,
          requestNo: req.requestNo,
          phone: req.phone,
          status: dto.status,
          note: normalizedNote,
        },
        tx,
      );

      return {
        id,
        status: dto.status,
        ...(magicLinkPayload ? { magicLink: magicLinkPayload } : {}),
      };
    });
  }
  private async acquireRequestMutationLock(tx: Tx, requestId: string) {
    const lockKey = `request_mutation:${requestId}`;

    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT true AS "acquired"
    `;
  }
}

