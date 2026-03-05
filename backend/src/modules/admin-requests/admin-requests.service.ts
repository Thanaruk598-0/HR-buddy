import { NotFoundException, Injectable } from '@nestjs/common';
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
        select: { status: true },
      });

      if (!req) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Request not found',
        });
      }

      assertValidTransition(req.status, dto.status);

      await tx.request.update({
        where: { id },
        data: {
          status: dto.status,
          latestActivityAt: new Date(),
          closedAt: dto.status === 'DONE' ? new Date() : null,
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
          note: dto.note,
        },
      });
    });
  }
}
