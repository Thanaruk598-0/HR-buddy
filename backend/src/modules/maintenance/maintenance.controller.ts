import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { AdminSessionGuard } from '../admin-auth/admin-session.guard';
import { AnonymizeRequestDto } from './dto/anonymize-request.dto';
import { MaintenanceService } from './maintenance.service';

@Controller('admin/maintenance')
@UseGuards(AdminSessionGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('retention/run')
  runRetentionNow() {
    return this.maintenanceService.runRetentionJob('manual');
  }

  @Post('pdpa/requests/:id/anonymize')
  anonymizeRequest(@Param('id') id: string, @Body() dto: AnonymizeRequestDto) {
    return this.maintenanceService.anonymizeRequestData(id, dto);
  }
}
