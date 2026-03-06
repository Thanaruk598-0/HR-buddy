import { Injectable, NotFoundException } from '@nestjs/common';
import {
  NotificationEventType,
  Prisma,
  RecipientRole,
  RequestStatus,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationListQueryDto } from './dto/notification-list.query.dto';

type Tx = Prisma.TransactionClient;
type DbClient = PrismaService | Tx;

type CreateNotificationInput = {
  recipientRole: RecipientRole;
  recipientPhone?: string | null;
  requestId?: string | null;
  eventType: NotificationEventType;
  title: string;
  message: string;
};

const STATUS_TO_EVENT: Partial<Record<RequestStatus, NotificationEventType>> = {
  APPROVED: NotificationEventType.APPROVED,
  REJECTED: NotificationEventType.REJECTED,
  DONE: NotificationEventType.DONE,
  CANCELED: NotificationEventType.CANCELED,
};

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreateNotificationInput, tx?: Tx) {
    return this.client(tx).notification.create({
      data: {
        recipientRole: data.recipientRole,
        recipientPhone: data.recipientPhone ?? null,
        requestId: data.requestId ?? null,
        eventType: data.eventType,
        title: data.title,
        message: data.message,
      },
    });
  }

  async notifyEmployeeStatusChange(
    params: {
      requestId: string;
      requestNo: string;
      phone: string;
      status: RequestStatus;
      note?: string | null;
    },
    tx?: Tx,
  ) {
    const eventType = STATUS_TO_EVENT[params.status];

    if (!eventType) {
      return;
    }

    const noteText = params.note?.trim();

    await this.create(
      {
        recipientRole: RecipientRole.EMPLOYEE,
        recipientPhone: params.phone,
        requestId: params.requestId,
        eventType,
        title: `Request ${params.requestNo} is ${params.status}`,
        message: noteText
          ? `Status changed to ${params.status}. Note: ${noteText}`
          : `Status changed to ${params.status}.`,
      },
      tx,
    );
  }

  async notifyAdminMessengerBooked(
    params: {
      requestId: string;
      requestNo: string;
      employeeName: string;
    },
    tx?: Tx,
  ) {
    await this.create(
      {
        recipientRole: RecipientRole.ADMIN,
        requestId: params.requestId,
        eventType: NotificationEventType.MESSENGER_BOOKED,
        title: 'New messenger booking request',
        message: `Request ${params.requestNo} from ${params.employeeName}`,
      },
      tx,
    );
  }

  async notifyAdminRequestCanceled(
    params: {
      requestId: string;
      requestNo: string;
      reason: string;
    },
    tx?: Tx,
  ) {
    await this.create(
      {
        recipientRole: RecipientRole.ADMIN,
        requestId: params.requestId,
        eventType: NotificationEventType.CANCELED,
        title: 'Request canceled by employee',
        message: `Request ${params.requestNo}: ${params.reason}`,
      },
      tx,
    );
  }

  async notifyAdminProblemReported(
    params: {
      requestId: string;
      requestNo: string;
      note: string;
    },
    tx?: Tx,
  ) {
    await this.create(
      {
        recipientRole: RecipientRole.ADMIN,
        requestId: params.requestId,
        eventType: NotificationEventType.PROBLEM_REPORTED,
        title: 'Messenger reported a problem',
        message: `Request ${params.requestNo}: ${params.note}`,
      },
      tx,
    );
  }

  async listForEmployee(phone: string, q: NotificationListQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      recipientRole: RecipientRole.EMPLOYEE,
      recipientPhone: phone,
      ...(q.isRead !== undefined ? { isRead: q.isRead } : {}),
      ...(q.eventType ? { eventType: q.eventType } : {}),
    };

    return this.list(where, q);
  }

  async listForAdmin(q: NotificationListQueryDto) {
    const where: Prisma.NotificationWhereInput = {
      recipientRole: RecipientRole.ADMIN,
      ...(q.isRead !== undefined ? { isRead: q.isRead } : {}),
      ...(q.eventType ? { eventType: q.eventType } : {}),
    };

    return this.list(where, q);
  }

  async markAsReadForEmployee(id: string, phone: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        recipientRole: RecipientRole.EMPLOYEE,
        recipientPhone: phone,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    return { ok: true };
  }

  async markAllAsReadForEmployee(phone: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientRole: RecipientRole.EMPLOYEE,
        recipientPhone: phone,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  async markAsReadForAdmin(id: string) {
    const result = await this.prisma.notification.updateMany({
      where: {
        id,
        recipientRole: RecipientRole.ADMIN,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    if (result.count === 0) {
      throw new NotFoundException({
        code: 'NOTIFICATION_NOT_FOUND',
        message: 'Notification not found',
      });
    }

    return { ok: true };
  }

  async markAllAsReadForAdmin() {
    const result = await this.prisma.notification.updateMany({
      where: {
        recipientRole: RecipientRole.ADMIN,
        isRead: false,
      },
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    return { updated: result.count };
  }

  private async list(
    where: Prisma.NotificationWhereInput,
    q: NotificationListQueryDto,
  ) {
    const MAX_LIMIT = 200;
    const DEFAULT_LIMIT = 20;
    const DEFAULT_PAGE = 1;

    const limit = Math.min(q.limit ?? DEFAULT_LIMIT, MAX_LIMIT);
    const page = q.page ?? DEFAULT_PAGE;
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      this.prisma.notification.count({ where }),
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          requestId: true,
          eventType: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true,
          readAt: true,
        },
      }),
    ]);

    return {
      items,
      page,
      limit,
      total,
    };
  }

  private client(tx?: Tx): DbClient {
    return tx ?? this.prisma;
  }
}
