import { Controller, Get, Param, Patch, Query, Body } from '@nestjs/common';
import { AdminRequestsService } from './admin-requests.service';
import { AdminRequestsQueryDto } from './dto/admin-requests.query.dto';
import {
  AdminRequestDetailResponse,
  AdminRequestListResponse,
} from './admin-requests.types';
import { AdminRequestActionDto } from './dto/admin-request-action.dto';

@Controller('admin/requests')
export class AdminRequestsController {
  constructor(private readonly svc: AdminRequestsService) {}

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
}
