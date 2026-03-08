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
  Prisma,
  RecipientRole,
  RequestStatus,
} from '@prisma/client';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { AnonymizeRequestDto } from './dto/anonymize-request.dto';
import { AnonymizeSubjectDto } from './dto/anonymize-subject.dto';
import {
  assertAnonymizeEligibility,
  normalizeAnonymizeReason,
} from './rules/pdpa-anonymize.rules';
import { cutoffFromDays } from './utils/retention.util';

type RetentionMode = 'manual' | 'auto';

type AnonymizeRequestProjection = {
  id: string;
  requestNo: string;
  status: RequestStatus;
  closedAt: Date | null;
  messengerBookingDetail: {
    senderAddressId: string;
    receiverAddressId: string;
  } | null;
  documentRequestDetail: {
    deliveryAddressId: string | null;
  } | null;
};

type RequestMaskResult = {
  addressCount: number;
  employeeNotificationCount: number;
};

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
    let lockAcquired = false;

    try {
      lockAcquired = await this.tryAcquireRetentionLock();

      if (!lockAcquired) {
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
              OR: [
                { expiresAt: { lt: now } },
                { createdAt: { lt: otpCutoff } },
              ],
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
      if (lockAcquired) {
        await this.releaseRetentionLock();
      }

      this.isRunning = false;
    }
  }

  async anonymizeRequestData(id: string, dto: AnonymizeRequestDto) {
    return this.prisma.$transaction(async (tx) => {
      const request = await this.getRequestProjection(tx, id);

      if (!request) {
        throw new NotFoundException({
          code: 'NOT_FOUND',
          message: 'Request not found',
        });
      }

      await this.assertOperatorActive(tx, dto.operatorId);

      assertAnonymizeEligibility({
        status: request.status,
        closedAt: request.closedAt,
        minClosedDays: this.pdpaAnonymizeMinClosedDays(),
      });

      const now = new Date();
      const normalizedReason = normalizeAnonymizeReason(dto.reason);

      const masked = await this.maskRequestIdentity(tx, request, now);
      await this.writePdpaAuditLog(
        tx,
        request.id,
        request.status,
        dto.operatorId,
        normalizedReason,
      );

      return {
        id: request.id,
        requestNo: request.requestNo,
        status: request.status,
        anonymizedAt: now,
        masked: {
          requestIdentity: true,
          addressCount: masked.addressCount,
          employeeNotificationCount: masked.employeeNotificationCount,
        },
      };
    });
  }

  async anonymizeSubjectData(dto: AnonymizeSubjectDto) {
    return this.prisma.$transaction(async (tx) => {
      await this.assertOperatorActive(tx, dto.operatorId);

      const phone = dto.phone.trim();
      const email = dto.email.trim().toLowerCase();
      const now = new Date();
      const normalizedReason = normalizeAnonymizeReason(dto.reason);

      const requests = await tx.request.findMany({
        where: { phone },
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
        orderBy: { createdAt: 'asc' },
      });

      if (requests.length === 0) {
        throw new NotFoundException({
          code: 'PDPA_SUBJECT_NOT_FOUND',
          message: 'No requests found for this subject phone',
        });
      }

      const ineligibleRequestNos: string[] = [];

      for (const request of requests) {
        try {
          assertAnonymizeEligibility({
            status: request.status,
            closedAt: request.closedAt,
            minClosedDays: this.pdpaAnonymizeMinClosedDays(),
            now,
          });
        } catch {
          ineligibleRequestNos.push(request.requestNo);
        }
      }

      if (ineligibleRequestNos.length > 0) {
        throw new BadRequestException({
          code: 'PDPA_SUBJECT_CONTAINS_INELIGIBLE_REQUESTS',
          message: 'Some requests are not eligible for anonymization yet',
          requestNos: ineligibleRequestNos,
        });
      }

      let maskedAddressCount = 0;
      let maskedRequestNotificationCount = 0;

      for (const request of requests) {
        const masked = await this.maskRequestIdentity(tx, request, now);
        maskedAddressCount += masked.addressCount;
        maskedRequestNotificationCount += masked.employeeNotificationCount;
        await this.writePdpaAuditLog(
          tx,
          request.id,
          request.status,
          dto.operatorId,
          `SUBJECT:${normalizedReason}`,
        );
      }

      const [
        employeeNotifications,
        employeeSessions,
        otpSessions,
        activityLogs,
      ] = await Promise.all([
        tx.notification.updateMany({
          where: {
            recipientRole: RecipientRole.EMPLOYEE,
            recipientPhone: phone,
          },
          data: {
            recipientPhone: null,
          },
        }),
        tx.employeeAccessSession.deleteMany({
          where: {
            phone,
            email,
          },
        }),
        tx.otpSession.deleteMany({
          where: {
            phone,
            email,
          },
        }),
        tx.requestActivityLog.updateMany({
          where: {
            requestId: { in: requests.map((request) => request.id) },
            actorRole: ActorRole.EMPLOYEE,
          },
          data: {
            actorDisplayName: 'REDACTED',
          },
        }),
      ]);

      return {
        subject: {
          phone,
          email,
        },
        anonymizedAt: now,
        requests: {
          count: requests.length,
          requestNos: requests.map((request) => request.requestNo),
        },
        masked: {
          requestIdentityCount: requests.length,
          addressCount: maskedAddressCount,
          requestNotificationCount: maskedRequestNotificationCount,
          employeeNotificationCount: employeeNotifications.count,
          employeeActivityLogCount: activityLogs.count,
        },
        deleted: {
          employeeSessions: employeeSessions.count,
          otpSessions: otpSessions.count,
        },
      };
    });
  }

  private async getRequestProjection(
    tx: Prisma.TransactionClient,
    id: string,
  ): Promise<AnonymizeRequestProjection | null> {
    return tx.request.findUnique({
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
  }

  private async assertOperatorActive(
    tx: Prisma.TransactionClient,
    operatorId: string,
  ) {
    const operator = await tx.operator.findUnique({
      where: { id: operatorId },
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
  }

  private collectAddressIds(request: AnonymizeRequestProjection) {
    return [
      request.messengerBookingDetail?.senderAddressId,
      request.messengerBookingDetail?.receiverAddressId,
      request.documentRequestDetail?.deliveryAddressId,
    ].filter((value, index, self): value is string => {
      return Boolean(value) && self.indexOf(value) === index;
    });
  }

  private async maskRequestIdentity(
    tx: Prisma.TransactionClient,
    request: AnonymizeRequestProjection,
    now: Date,
  ): Promise<RequestMaskResult> {
    const addressIds = this.collectAddressIds(request);

    await tx.request.update({
      where: { id: request.id },
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
        requestId: request.id,
        recipientRole: RecipientRole.EMPLOYEE,
      },
      data: {
        recipientPhone: null,
      },
    });

    return {
      addressCount: maskedAddressResult.count,
      employeeNotificationCount: maskedNotificationResult.count,
    };
  }

  private async writePdpaAuditLog(
    tx: Prisma.TransactionClient,
    requestId: string,
    status: RequestStatus,
    operatorId: string,
    reason: string,
  ) {
    await tx.requestActivityLog.create({
      data: {
        requestId,
        action: ActivityAction.STATUS_CHANGE,
        fromStatus: status,
        toStatus: status,
        actorRole: ActorRole.ADMIN,
        operatorId,
        note: `PDPA_ANONYMIZED: ${reason}`,
      },
    });
  }

  private async tryAcquireRetentionLock() {
    if (!this.retentionUseDbLock()) {
      return true;
    }

    const lockKey = this.retentionDbLockKey();

    const rows = await this.prisma.$queryRaw<Array<{ acquired: boolean }>>`
      SELECT pg_try_advisory_lock(${lockKey}) AS acquired
    `;

    const acquired = rows[0]?.acquired === true;

    if (!acquired) {
      this.logger.warn(
        `Retention run skipped because db lock is held by another instance (key=${lockKey})`,
      );
    }

    return acquired;
  }

  private async releaseRetentionLock() {
    if (!this.retentionUseDbLock()) {
      return;
    }

    const lockKey = this.retentionDbLockKey();

    try {
      await this.prisma.$queryRaw`
        SELECT pg_advisory_unlock(${lockKey})
      `;
    } catch (error) {
      this.logger.warn(
        `Failed to release retention db lock (key=${lockKey}): ${(error as Error).message}`,
      );
    }
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

  private retentionUseDbLock() {
    return this.config.get<boolean>('retention.useDbLock') ?? true;
  }

  private retentionDbLockKey() {
    return this.config.get<number>('retention.dbLockKey') ?? 48151623;
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
