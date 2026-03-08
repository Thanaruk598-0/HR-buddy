import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { MessengerService } from './messenger.service';
import { MessengerStatusUpdateDto } from './dto/messenger-status-update.dto';
import { MessengerProblemReportDto } from './dto/messenger-problem-report.dto';
import { MessengerPickupEventDto } from './dto/messenger-pickup-event.dto';

@Controller('messenger')
export class MessengerController {
  constructor(private readonly messengerService: MessengerService) {}

  @Get('link/:token')
  getByToken(@Param('token') token: string) {
    return this.messengerService.getByToken(token);
  }

  @Patch('link/:token/status')
  updateStatus(
    @Param('token') token: string,
    @Body() dto: MessengerStatusUpdateDto,
  ) {
    return this.messengerService.updateStatus(token, dto);
  }

  @Post('link/:token/report-problem')
  reportProblem(
    @Param('token') token: string,
    @Body() dto: MessengerProblemReportDto,
  ) {
    return this.messengerService.reportProblem(token, dto);
  }

  @Post('link/:token/pickup-event')
  pickupEvent(
    @Param('token') token: string,
    @Body() dto: MessengerPickupEventDto,
  ) {
    return this.messengerService.pickupEvent(token, dto);
  }
}
