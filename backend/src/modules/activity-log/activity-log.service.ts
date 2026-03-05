import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ActivityAction, ActorRole } from '@prisma/client';

@Injectable()
export class ActivityLogService {
  constructor(private prisma: PrismaService) {}

  async create(data: {
    requestId: string;
    action: ActivityAction;
    actorRole: ActorRole;
    operatorId?: string;
    note?: string;
  }) {
    return this.prisma.requestActivityLog.create({
      data: {
        requestId: data.requestId,
        action: data.action,
        actorRole: data.actorRole,
        operatorId: data.operatorId,
        note: data.note,
      },
    });
  }
}
