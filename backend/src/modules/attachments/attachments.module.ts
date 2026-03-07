import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { AttachmentsService } from './attachments.service';
import { AttachmentStorageService } from './storage/attachment-storage.service';
import { LocalAttachmentStorageProvider } from './storage/local-attachment-storage.provider';
import { WebhookAttachmentStorageProvider } from './storage/webhook-attachment-storage.provider';

@Module({
  imports: [PrismaModule],
  providers: [
    AttachmentsService,
    AttachmentStorageService,
    LocalAttachmentStorageProvider,
    WebhookAttachmentStorageProvider,
  ],
  exports: [AttachmentsService],
})
export class AttachmentsModule {}
