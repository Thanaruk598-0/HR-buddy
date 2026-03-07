import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
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
}
