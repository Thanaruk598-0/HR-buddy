import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import {
  ActivityAction,
  ActorRole,
  RecipientRole,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AnonymizeRequestDto } from './dto/anonymize-request.dto';
import {
  assertAnonymizeEligibility,
  normalizeAnonymizeReason,
} from './rules/pdpa-anonymize.rules';
import { cutoffFromDays } from './utils/retention.util';

type RetentionMode = 'manual' | 'auto';

export type RetentionRunResult = {
  mode: RetentionMode;
  executedAt: Date;
  skipped: boolean;
  deleted: {
    otpSessions: number;
    employeeSessions: number;
    notifications: number;
    activityLogs: number;
  };
};

@Injectable()
export class MaintenanceService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MaintenanceService.name);
  private intervalRef: NodeJS.Timeout | null = null;
  private isRunning = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async onModuleInit() {
    if (!this.retentionEnabled()) {
      return;
    }

    if (this.retentionRunOnStartup()) {
      void this.runRetentionJob('auto');
    }

    const intervalMs = this.retentionIntervalHours() * 60 * 60 * 1000;

    this.intervalRef = setInterval(() => {
      void this.runRetentionJob('auto');
    }, intervalMs);

    this.logger.log(
      `Retention job enabled (interval=${this.retentionIntervalHours()}h)`,
    );
  }

  onModuleDestroy() {
    if (this.intervalRef) {
      clearInterval(this.intervalRef);
      this.intervalRef = null;
    }
  }

  async runRetentionJob(mode: RetentionMode): Promise<RetentionRunResult> {
    if (this.isRunning) {
      return {
        mode,
        executedAt: new Date(),
        skipped: true,
        deleted: {
          otpSessions: 0,
          employeeSessions: 0,
          notifications: 0,
          activityLogs: 0,
        },
      };
    }

    this.isRunning = true;

    try {
      const now = new Date();

      const otpCutoff = cutoffFromDays(this.retentionOtpSessionsDays(), now);
      const employeeSessionCutoff = cutoffFromDays(
        this.retentionEmployeeSessionsDays(),
        now,
      );
      const notificationsCutoff = cutoffFromDays(
        this.retentionNotificationsDays(),
        now,
      );
      const activityLogsCutoff = cutoffFromDays(
        this.retentionActivityLogsDays(),
        now,
      );

      const [otpSessions, employeeSessions, notifications, activityLogs] =
        await this.prisma.$transaction([
          this.prisma.otpSession.deleteMany({
            where: {
              OR: [{ expiresAt: { lt: now } }, { createdAt: { lt: otpCutoff } }],
            },
          }),
          this.prisma.employeeAccessSession.deleteMany({
            where: {
              OR: [
                { expiresAt: { lt: now } },
                { createdAt: { lt: employeeSessionCutoff } },
              ],
            },
          }),
          this.prisma.notification.deleteMany({
            where: { createdAt: { lt: notificationsCutoff } },
          }),
          this.prisma.requestActivityLog.deleteMany({
            where: { createdAt: { lt: activityLogsCutoff } },
          }),
        ]);

      const result: RetentionRunResult = {
        mode,
        executedAt: now,
        skipped: false,
        deleted: {
          otpSessions: otpSessions.count,
          employeeSessions: employeeSessions.count,
          notifications: notifications.count,
          activityLogs: activityLogs.count,
        },
      };

      this.logger.log(
        `Retention run (${mode}) deleted otp=${result.deleted.otpSessions}, sessions=${result.deleted.employeeSessions}, notifications=${result.deleted.notifications}, logs=${result.deleted.activityLogs}`,
      );

      return result;
    } catch (error) {
      this.logger.error(`Retention run failed (${mode})`, error as Error);
      throw error;
    } finally {
      this.isRunning = false;
    }
  }

  async anonymizeRequestData(id: string, dto: AnonymizeRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await tx.request.findUnique({
        where: { id },
        select: {
          id: true,
          requestNo: true,
          status: true,
          closedAt: true,
          messengerBookingDetail: {
            select: {
              senderAddressId: true,
              receiverAddressId: true,
            },
          },
          documentRequestDetail: {
            select: {
              deliveryAddressId: true,
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Request not found',
        });
      }

      const operator = await tx.operator.findUnique({
        where: { id: dto.operatorId },
        select: {
          id: true,
          isActive: true,
        },
      });

      if (!operator) {
        throw new BadRequestException({
          code: 'INVALID_OPERATOR_ID',
          message: 'Invalid operatorId',
        });
      }

      if (!operator.isActive) {
        throw new BadRequestException({
          code: 'OPERATOR_INACTIVE',
          message: 'operatorId is inactive',
        });
      }

      assertAnonymizeEligibility({
        status: request.status,
        closedAt: request.closedAt,
        minClosedDays: this.pdpaAnonymizeMinClosedDays(),
      });

      const now = new Date();
      const normalizedReason = normalizeAnonymizeReason(dto.reason);

      const addressIds = [
        request.messengerBookingDetail?.senderAddressId,
        request.messengerBookingDetail?.receiverAddressId,
        request.documentRequestDetail?.deliveryAddressId,
      ].filter((value, index, self): value is string => {
        return Boolean(value) && self.indexOf(value) === index;
      });

      await tx.request.update({
        where: { id },
        data: {
          employeeName: 'REDACTED',
          phone: 'REDACTED',
          cancelReason: null,
          hrCloseNote: null,
          latestActivityAt: now,
        },
      });

      const maskedAddressResult =
        addressIds.length > 0
          ? await tx.address.updateMany({
              where: { id: { in: addressIds } },
              data: {
                name: 'REDACTED',
                phone: 'REDACTED',
                houseNo: 'REDACTED',
                soi: null,
                road: null,
                extra: null,
              },
            })
          : { count: 0 };

      const maskedNotificationResult = await tx.notification.updateMany({
        where: {
          requestId: id,
          recipientRole: RecipientRole.EMPLOYEE,
        },
        data: {
          recipientPhone: null,
        },
      });

      await tx.requestActivityLog.create({
        data: {
          requestId: id,
          action: ActivityAction.STATUS_CHANGE,
          fromStatus: request.status,
          toStatus: request.status,
          actorRole: ActorRole.ADMIN,
          operatorId: dto.operatorId,
          note: `PDPA_ANONYMIZED: ${normalizedReason}`,
        },
      });

      return {
        id: request.id,
        requestNo: request.requestNo,
        status: request.status,
        anonymizedAt: now,
        masked: {
          requestIdentity: true,
          addressCount: maskedAddressResult.count,
          employeeNotificationCount: maskedNotificationResult.count,
        },
      };
    });
  }

  private retentionEnabled() {
    return this.config.get<boolean>('retention.enabled') ?? false;
  }

  private retentionRunOnStartup() {
    return this.config.get<boolean>('retention.runOnStartup') ?? false;
  }

  private retentionIntervalHours() {
    return this.config.get<number>('retention.intervalHours') ?? 24;
  }

  private retentionOtpSessionsDays() {
    return this.config.get<number>('retention.otpSessionsDays') ?? 7;
  }

  private retentionEmployeeSessionsDays() {
    return this.config.get<number>('retention.employeeSessionsDays') ?? 7;
  }

  private retentionNotificationsDays() {
    return this.config.get<number>('retention.notificationsDays') ?? 180;
  }

  private retentionActivityLogsDays() {
    return this.config.get<number>('retention.activityLogsDays') ?? 365;
  }

  private pdpaAnonymizeMinClosedDays() {
    return this.config.get<number>('pdpa.anonymizeMinClosedDays') ?? 30;
  }
}

