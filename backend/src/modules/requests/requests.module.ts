import { Module } from '@nestjs/common';
import { AttachmentsModule } from '../attachments/attachments.module';
import { AuthOtpModule } from '../auth-otp/auth-otp.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';

@Module({
  imports: [AuthOtpModule, NotificationsModule, AttachmentsModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}