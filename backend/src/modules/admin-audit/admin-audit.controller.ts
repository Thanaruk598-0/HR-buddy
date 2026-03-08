import { Controller, Get, Header, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { AdminSessionGuard } from '../admin-auth/admin-session.guard';
import { AdminAuditService } from './admin-audit.service';
import { AdminAuditLogListResponse } from './admin-audit.types';
import { AdminAuditExportQueryDto } from './dto/admin-audit-export.query.dto';
import { AdminAuditListQueryDto } from './dto/admin-audit-list.query.dto';

@Controller('admin/audit')
@UseGuards(AdminSessionGuard)
export class AdminAuditController {
  constructor(private readonly svc: AdminAuditService) {}

  @Get('activity-logs')
  list(@Query() q: AdminAuditListQueryDto): Promise<AdminAuditLogListResponse> {
    return this.svc.list(q);
  }

  @Get('activity-logs/export/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query() q: AdminAuditExportQueryDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    const result = await this.svc.exportCsv(q);

    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${result.fileName}"`,
    );
    res.setHeader('X-Export-Row-Count', String(result.rowCount));

    return result.csvContent;
  }
}
