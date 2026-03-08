import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { MessengerController } from './messenger.controller';
import { MessengerService } from './messenger.service';

@Module({
  imports: [PrismaModule, NotificationsModule],
  controllers: [MessengerController],
  providers: [MessengerService],
  exports: [MessengerService],
})
export class MessengerModule {}
