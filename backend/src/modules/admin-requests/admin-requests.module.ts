import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AttachmentsModule } from '../attachments/attachments.module';
import { MessengerModule } from '../messenger/messenger.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AdminRequestsController } from './admin-requests.controller';
import { AdminRequestsService } from './admin-requests.service';

@Module({
  imports: [
    PrismaModule,
    MessengerModule,
    NotificationsModule,
    AttachmentsModule,
  ],
  controllers: [AdminRequestsController],
  providers: [AdminRequestsService],
})
export class AdminRequestsModule {}