import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CreateAttachmentDto } from '../attachments/dto/create-attachment.dto';
import { AttachmentsService } from '../attachments/attachments.service';
import { AdminRequestActionDto } from './dto/admin-request-action.dto';
import { AdminRequestsQueryDto } from './dto/admin-requests.query.dto';
import {
  AdminRequestDetailResponse,
  AdminRequestListResponse,
} from './admin-requests.types';
import { AdminRequestsService } from './admin-requests.service';

@Controller('admin/requests')
export class AdminRequestsController {
  constructor(
    private readonly svc: AdminRequestsService,
    private readonly attachmentsService: AttachmentsService,
  ) {}

  @Get()
  list(@Query() q: AdminRequestsQueryDto): Promise<AdminRequestListResponse> {
    return this.svc.list(q);
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
