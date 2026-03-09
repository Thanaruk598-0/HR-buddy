import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AttachmentsService } from './attachments.service';
import { AttachmentStorageService } from './storage/attachment-storage.service';
import { B2AttachmentStorageProvider } from './storage/b2-attachment-storage.provider';
import { LocalAttachmentStorageProvider } from './storage/local-attachment-storage.provider';
import { LocalMockAttachmentStorageController } from './storage/local-mock-attachment-storage.controller';
import { LocalMockAttachmentStorageService } from './storage/local-mock-attachment-storage.service';
import { WebhookAttachmentStorageProvider } from './storage/webhook-attachment-storage.provider';

@Module({
  imports: [PrismaModule],
  controllers: [LocalMockAttachmentStorageController],
  providers: [
    AttachmentsService,
    AttachmentStorageService,
    LocalMockAttachmentStorageService,
    LocalAttachmentStorageProvider,
    WebhookAttachmentStorageProvider,
    B2AttachmentStorageProvider,
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
