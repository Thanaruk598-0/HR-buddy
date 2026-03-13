import {
  Body,
  Controller,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CompleteAttachmentUploadDto } from '../attachments/dto/complete-attachment-upload.dto';
import { CreateAttachmentDto } from '../attachments/dto/create-attachment.dto';
import { CreateAttachmentUploadTicketDto } from '../attachments/dto/create-attachment-upload-ticket.dto';
import { AttachmentDownloadUrlQueryDto } from '../attachments/dto/attachment-download-url.query.dto';
import { AttachmentsService } from '../attachments/attachments.service';
import { AdminSessionGuard } from '../admin-auth/admin-session.guard';
import { AdminRequestActionDto } from './dto/admin-request-action.dto';
import { AdminRequestsExportQueryDto } from './dto/admin-requests-export.query.dto';
import { AdminRequestsQueryDto } from './dto/admin-requests.query.dto';
import { AdminRequestsReportQueryDto } from './dto/admin-requests-report.query.dto';
import {
  AdminRequestDetailResponse,
  AdminRequestListResponse,
  AdminRequestSummaryResponse,
} from './admin-requests.types';
import { AdminRequestsService } from './admin-requests.service';

@Controller('admin/requests')
@UseGuards(AdminSessionGuard)
export class AdminRequestsController {
  constructor(
    private readonly svc: AdminRequestsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Get()
  list(@Query() q: AdminRequestsQueryDto): Promise<AdminRequestListResponse> {
    return this.svc.list(q);
  }

  @Get('report/summary')
  summary(
    @Query() q: AdminRequestsReportQueryDto,
  ): Promise<AdminRequestSummaryResponse> {
    return this.svc.summary(q);
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  async exportCsv(
    @Query() q: AdminRequestsExportQueryDto,
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

  @Get(':id/attachments/:attachmentId/download-url')
  downloadAttachment(
    @Param('id') id: string,
    @Param('attachmentId') attachmentId: string,
    @Query() query: AttachmentDownloadUrlQueryDto,
  ) {
    return this.attachmentsService.getAdminDownloadUrl(
      id,
      attachmentId,
      query.mode,
    );
  }

  @Post(':id/attachments/presign')
  presignAttachment(
    @Param('id') id: string,
    @Body() dto: CreateAttachmentUploadTicketDto,
  ) {
    return this.attachmentsService.issueAdminUploadTicket(id, dto);
  }

  @Post(':id/attachments/complete')
  completeAttachment(
    @Param('id') id: string,
    @Body() dto: CompleteAttachmentUploadDto,
  ) {
    return this.attachmentsService.completeAdminUpload(id, dto);
  }

  @Get(':id')
  detail(@Param('id') id: string): Promise<AdminRequestDetailResponse> {
    return this.svc.detail(id);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: AdminRequestActionDto) {
    return this.svc.updateStatus(id, dto);
  }

  @Post(':id/attachments')
  addAttachment(@Param('id') id: string, @Body() dto: CreateAttachmentDto) {
    return this.attachmentsService.addAdminAttachment(id, dto);
  }
}
