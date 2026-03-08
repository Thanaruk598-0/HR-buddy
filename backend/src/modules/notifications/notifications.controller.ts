import {
  Controller,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { EmployeeSession } from '../auth-otp/employee-session.decorator';
import { EmployeeSessionGuard } from '../auth-otp/employee-session.guard';
import type { EmployeeSessionPrincipal } from '../auth-otp/employee-session.types';
import { NotificationListQueryDto } from './dto/notification-list.query.dto';
import { NotificationsService } from './notifications.service';

@Controller('notifications')
@UseGuards(EmployeeSessionGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Get('my')
  myList(
    @EmployeeSession() session: EmployeeSessionPrincipal,
    @Query() q: NotificationListQueryDto,
  ) {
    return this.notificationsService.listForEmployee(session.phone, q);
  }

  @Patch('my/:id/read')
  markRead(
    @Param('id') id: string,
    @EmployeeSession() session: EmployeeSessionPrincipal,
  ) {
    return this.notificationsService.markAsReadForEmployee(id, session.phone);
  }

  @Patch('my/read-all')
  markReadAll(@EmployeeSession() session: EmployeeSessionPrincipal) {
    return this.notificationsService.markAllAsReadForEmployee(session.phone);
  }
}
