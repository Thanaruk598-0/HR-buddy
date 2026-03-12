import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ActivityAction,
  ActorRole,
  Prisma,
  RequestStatus,
  RequestType,
} from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { MessengerPickupEventDto } from './dto/messenger-pickup-event.dto';
import { MessengerProblemReportDto } from './dto/messenger-problem-report.dto';
import { MessengerStatusUpdateDto } from './dto/messenger-status-update.dto';
import {
  assertMessengerTargetStatus,
  assertMessengerTransition,
} from './rules/messenger-transition.rules';
import {
  generateMagicLinkToken,
  hashMagicLinkToken,
} from './utils/magic-link-token.util';

type Tx = Prisma.TransactionClient;

type LinkRequestBase = {
  id: string;
  requestNo: string;
  type: RequestType;
  status: RequestStatus;
  phone: string;
};

type LinkWithRequestBase = {
  id: string;
  requestId: string;
  tokenHash: string;
  expiresAt: Date;
  revokedAt: Date | null;
  lastUsedAt: Date | null;
  request: LinkRequestBase;
};

@Injectable()
export class MessengerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async getByToken(token: string) {
    const tokenHash = this.hashToken(token);

    const link = await this.prisma.magicLink.findUnique({
      where: { tokenHash },
      include: {
        request: {
          include: {
            messengerBookingDetail: {
              include: {
                senderAddress: true,
                receiverAddress: true,
              },
            },
          },
        },
      },
    });

    this.assertLinkActive(link);

    await this.prisma.magicLink.update({
      where: { id: link.id },
      data: { lastUsedAt: new Date() },
      select: { id: true },
    });

    return {
      request: {
        id: link.request.id,
        requestNo: link.request.requestNo,
        status: link.request.status,
        type: link.request.type,
        urgency: link.request.urgency,
        latestActivityAt: link.request.latestActivityAt,
      },
      messengerDetail: link.request.messengerBookingDetail,
      expiresAt: link.expiresAt,
    };
  }

  async updateStatus(token: string, dto: MessengerStatusUpdateDto) {
    const tokenHash = this.hashToken(token);

    return this.prisma.$transaction(async (tx) => {
      const link = await this.getActiveLinkWithRequestOrThrow(tx, tokenHash);
      await this.acquireMessengerMutationLock(tx, link.requestId);

      assertMessengerTargetStatus(dto.status);
      assertMessengerTransition(link.request.status, dto.status);

      const now = new Date();
      const normalizedNote = this.normalizeOptionalText(dto.note);

      await tx.request.update({
        where: { id: link.requestId },
        data: {
          status: dto.status,
          latestActivityAt: now,
          closedAt: dto.status === RequestStatus.DONE ? now : null,
        },
      });

      await tx.requestActivityLog.create({
        data: {
          requestId: link.requestId,
          action: ActivityAction.STATUS_CHANGE,
          fromStatus: link.request.status,
          toStatus: dto.status,
          note: normalizedNote,
          actorRole: ActorRole.MESSENGER,
        },
      });

      await tx.magicLink.update({
        where: { id: link.id },
        data: {
          lastUsedAt: now,
          revokedAt: dto.status === RequestStatus.DONE ? now : null,
        },
      });

      await this.notificationsService.notifyEmployeeStatusChange(
        {
          requestId: link.requestId,
          requestNo: link.request.requestNo,
          phone: link.request.phone,
          status: dto.status,
          note: normalizedNote,
        },
        tx,
      );

      return {
        id: link.request.id,
        requestNo: link.request.requestNo,
        status: dto.status,
      };
    });
  }

  async reportProblem(token: string, dto: MessengerProblemReportDto) {
    const tokenHash = this.hashToken(token);

    return this.prisma.$transaction(async (tx) => {
      const link = await this.getActiveLinkWithRequestOrThrow(tx, tokenHash);
      await this.acquireMessengerMutationLock(tx, link.requestId);
      await this.assertNoMutationReplay(
        tx,
        link.requestId,
        ActivityAction.REPORT_PROBLEM,
      );

      const now = new Date();
      const normalizedNote = this.normalizeRequiredText(dto.note, 'note');

      await tx.requestActivityLog.create({
        data: {
          requestId: link.requestId,
          action: ActivityAction.REPORT_PROBLEM,
          note: normalizedNote,
          actorRole: ActorRole.MESSENGER,
        },
      });

      await tx.request.update({
        where: { id: link.requestId },
        data: { latestActivityAt: now },
      });

      await tx.magicLink.update({
        where: { id: link.id },
        data: { lastUsedAt: now },
      });

      await this.notificationsService.notifyAdminProblemReported(
        {
          requestId: link.requestId,
          requestNo: link.request.requestNo,
          note: normalizedNote,
        },
        tx,
      );

      return { ok: true };
    });
  }

  async pickupEvent(token: string, dto: MessengerPickupEventDto) {
    const tokenHash = this.hashToken(token);

    return this.prisma.$transaction(async (tx) => {
      const link = await this.getActiveLinkWithRequestOrThrow(tx, tokenHash);
      await this.acquireMessengerMutationLock(tx, link.requestId);
      await this.assertNoMutationReplay(
        tx,
        link.requestId,
        ActivityAction.MESSENGER_PICKUP_EVENT,
      );

      if (
        link.request.status !== RequestStatus.APPROVED &&
        link.request.status !== RequestStatus.IN_TRANSIT
      ) {
        throw new BadRequestException({
          code: 'PICKUP_EVENT_NOT_ALLOWED',
          message: `Cannot mark pickup on status ${link.request.status}`,
        });
      }

      const now = new Date();

      await tx.requestActivityLog.create({
        data: {
          requestId: link.requestId,
          action: ActivityAction.MESSENGER_PICKUP_EVENT,
          note: this.normalizeOptionalText(dto.note),
          actorRole: ActorRole.MESSENGER,
        },
      });

      await tx.request.update({
        where: { id: link.requestId },
        data: { latestActivityAt: now },
      });

      await tx.magicLink.update({
        where: { id: link.id },
        data: { lastUsedAt: now },
      });

      return { ok: true };
    });
  }

  async createOrRotateMagicLinkForRequest(tx: Tx, requestId: string) {
    const token = generateMagicLinkToken();
    const tokenHash = this.hashToken(token);
    const expiresAt = this.hoursFromNow(this.magicLinkTtlHours());

    await tx.magicLink.upsert({
      where: { requestId },
      create: {
        requestId,
        tokenHash,
        expiresAt,
      },
      update: {
        tokenHash,
        expiresAt,
        revokedAt: null,
        lastUsedAt: null,
      },
    });

    return {
      token,
      url: this.buildMagicLinkUrl(token),
      expiresAt,
    };
  }

  async revokeMagicLinkForRequest(tx: Tx, requestId: string) {
    await tx.magicLink.updateMany({
      where: {
        requestId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
      },
    });
  }

  private async getActiveLinkWithRequestOrThrow(tx: Tx, tokenHash: string) {
    const link = await tx.magicLink.findUnique({
      where: { tokenHash },
      include: {
        request: {
          select: {
            id: true,
            requestNo: true,
            type: true,
            status: true,
            phone: true,
          },
        },
      },
    });

    this.assertLinkActive(link);

    return link;
  }

  private assertLinkActive(
    link: LinkWithRequestBase | null,
  ): asserts link is LinkWithRequestBase {
    if (!link) {
      throw new NotFoundException({
        code: 'MAGIC_LINK_NOT_FOUND',
        message: 'Magic link not found',
      });
    }

    if (link.request.type !== RequestType.MESSENGER) {
      throw new BadRequestException({
        code: 'INVALID_MAGIC_LINK_REQUEST_TYPE',
        message: 'Magic link is not for messenger request',
      });
    }

    if (link.revokedAt) {
      throw new BadRequestException({
        code: 'MAGIC_LINK_REVOKED',
        message: 'Magic link is revoked',
      });
    }

    if (link.expiresAt <= new Date()) {
      throw new BadRequestException({
        code: 'MAGIC_LINK_EXPIRED',
        message: 'Magic link is expired',
      });
    }
  }

  private async acquireMessengerMutationLock(tx: Tx, requestId: string) {
    const lockKey = this.messengerMutationLockKey(requestId);

    await tx.$queryRaw`
      WITH advisory_lock AS (
        SELECT pg_advisory_xact_lock(hashtext(${lockKey}))
      )
      SELECT true AS "acquired"
    `;
  }

  private messengerMutationLockKey(requestId: string) {
    return `request_mutation:${requestId}`;
  }

  private async assertNoMutationReplay(
    tx: Tx,
    requestId: string,
    action: ActivityAction,
  ) {
    const replayWindowSeconds = this.mutationReplayWindowSeconds();

    if (replayWindowSeconds <= 0) {
      return;
    }

    const now = Date.now();
    const since = new Date(now - replayWindowSeconds * 1000);
    const latestActivity = await tx.requestActivityLog.findFirst({
      where: {
        requestId,
        action,
        actorRole: ActorRole.MESSENGER,
        createdAt: {
          gte: since,
        },
      },
      select: {
        id: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    if (!latestActivity) {
      return;
    }

    const elapsedMs = now - latestActivity.createdAt.getTime();
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil((replayWindowSeconds * 1000 - elapsedMs) / 1000),
    );

    throw new BadRequestException({
      code: 'MAGIC_LINK_REPLAY_BLOCKED',
      message: `Repeated ${action} request is blocked. Please wait before retrying`,
      retryAfterSeconds,
    });
  }

  private hashToken(token: string) {
    return hashMagicLinkToken(token, this.magicLinkSecret());
  }

  private magicLinkSecret() {
    return (
      this.config.get<string>('messengerMagicLinkSecret') ??
      'dev-only-change-this-messenger-magic-link-secret'
    );
  }

  private magicLinkTtlHours() {
    return this.config.get<number>('messengerMagicLinkTtlHours') ?? 72;
  }

  private magicLinkBaseUrl() {
    return (
      this.config.get<string>('messengerMagicLinkBaseUrl') ??
      'http://localhost:3000/messenger'
    );
  }

  private mutationReplayWindowSeconds() {
    return this.config.get<number>('messengerMutationReplayWindowSeconds') ?? 5;
  }

  private buildMagicLinkUrl(token: string) {
    const base = this.magicLinkBaseUrl().replace(/\/$/, '');
    return `${base}/${token}`;
  }

  private hoursFromNow(hours: number) {
    return new Date(Date.now() + hours * 60 * 60 * 1000);
  }

  private normalizeOptionalText(value?: string) {
    if (value === undefined) {
      return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private normalizeRequiredText(value: string, field: string) {
    const normalized = value.trim();

    if (!normalized) {
      throw new BadRequestException({
        code: 'REQUIRED_TEXT_MISSING',
        message: `${field} is required`,
        field,
      });
    }

    return normalized;
  }
}

