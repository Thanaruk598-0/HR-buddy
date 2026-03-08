import { Module } from '@nestjs/common';
import { PrismaModule } from '../../prisma/prisma.module';
import { ReferenceController } from './reference.controller';
import { ReferenceService } from './reference.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReferenceController],
  providers: [ReferenceService],
})
export class ReferenceModule {}
