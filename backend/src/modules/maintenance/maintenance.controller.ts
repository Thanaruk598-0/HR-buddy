import { Controller, Post, UseGuards } from '@nestjs/common';
import { AdminSessionGuard } from '../admin-auth/admin-session.guard';
import { MaintenanceService } from './maintenance.service';

@Controller('admin/maintenance')
@UseGuards(AdminSessionGuard)
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Post('retention/run')
  runRetentionNow() {
    return this.maintenanceService.runRetentionJob('manual');
  }
}
