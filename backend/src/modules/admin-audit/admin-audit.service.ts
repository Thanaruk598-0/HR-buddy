import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { buildCsv } from '../admin-requests/utils/csv.util';
import { buildAdminAuditWhere } from './admin-audit-query.builder';
import {
  AdminAuditCsvExportResult,
  AdminAuditLogListResponse,
} from './admin-audit.types';
import { AdminAuditExportQueryDto } from './dto/admin-audit-export.query.dto';
import { AdminAuditListQueryDto } from './dto/admin-audit-list.query.dto';

const DEFAULT_PAGE = 1;
const DEFAULT_LIST_LIMIT = 50;
const MAX_LIST_LIMIT = 200;
const DEFAULT_EXPORT_LIMIT = 2000;
const MAX_EXPORT_LIMIT = 10000;

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: AdminAuditListQueryDto): Promise<AdminAuditLogListResponse> {
    const where = buildAdminAuditWhere(q);

    const page = q.page ?? DEFAULT_PAGE;
    const limit = Math.min(q.limit ?? DEFAULT_LIST_LIMIT, MAX_LIST_LIMIT);
    const skip = (page - 1) * limit;

    const [total, logs] = await Promise.all([
      this.prisma.requestActivityLog.count({ where }),
      this.prisma.requestActivityLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          request: {
            select: {
              id: true,
              requestNo: true,
              type: true,
              status: true,
            },
          },
          operator: {
            select: {
              id: true,
              displayName: true,
            },
          },
        },
      }),
    ]);

    const items = logs.map((log) => ({
      id: log.id,
      requestId: log.request.id,
      requestNo: log.request.requestNo,
      requestType: log.request.type,
      requestStatus: log.request.status,
      action: log.action,
      fromStatus: log.fromStatus,
      toStatus: log.toStatus,
      actorRole: log.actorRole,
      operatorId: log.operator?.id ?? null,
      operatorName: log.operator?.displayName ?? null,
      note: log.note,
      createdAt: log.createdAt,
    }));

    return {
      items,
      page,
      limit,
      total,
    };
  }

  async exportCsv(
    q: AdminAuditExportQueryDto,
  ): Promise<AdminAuditCsvExportResult> {
    const where = buildAdminAuditWhere(q);
    const limit = Math.min(q.limit ?? DEFAULT_EXPORT_LIMIT, MAX_EXPORT_LIMIT);

    const logs = await this.prisma.requestActivityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        request: {
          select: {
            requestNo: true,
            type: true,
            status: true,
          },
        },
        operator: {
          select: {
            displayName: true,
          },
        },
      },
    });

    const headers = [
      'createdAt',
      'requestNo',
      'requestType',
      'requestStatus',
      'action',
      'fromStatus',
      'toStatus',
      'actorRole',
      'operatorName',
      'note',
    ];

    const rows = logs.map((log) => [
      log.createdAt,
      log.request.requestNo,
      log.request.type,
      log.request.status,
      log.action,
      log.fromStatus,
      log.toStatus,
      log.actorRole,
      log.operator?.displayName ?? null,
      log.note,
    ]);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    return {
      fileName: `audit-activity-export-${timestamp}.csv`,
      rowCount: logs.length,
      csvContent: buildCsv(headers, rows),
    };
  }
}
