import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import {
  RateLimitConsumeInput,
  RateLimitConsumeResult,
} from './rate-limit.types';

type CounterRow = {
  windowStartAt: Date;
  requestCount: number;
  blockedUntil: Date | null;
};

@Injectable()
export class PostgresRateLimitStore {
  private readonly logger = new Logger(PostgresRateLimitStore.name);
  private cleanupRunning = false;
  private lastCleanupAtMs = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
    const nowMs = input.nowMs ?? Date.now();
    const nowAt = new Date(nowMs);
    const windowMs = Math.max(1, input.policy.windowSeconds) * 1000;
    const blockMs = Math.max(0, input.policy.blockSeconds) * 1000;
    const keyHash = this.hashKey(input.key);

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO abuse_rate_limit_counters (
          scope,
          key_hash,
          window_start_at,
          request_count,
          blocked_until,
          updated_at
        )
        VALUES (
          ${input.scope},
          ${keyHash},
          ${nowAt},
          0,
          NULL,
          ${nowAt}
        )
        ON CONFLICT (scope, key_hash) DO NOTHING
      `;

      const rows = await tx.$queryRaw<CounterRow[]>`
        SELECT
          window_start_at AS "windowStartAt",
          request_count AS "requestCount",
          blocked_until AS "blockedUntil"
        FROM abuse_rate_limit_counters
        WHERE scope = ${input.scope}
          AND key_hash = ${keyHash}
        FOR UPDATE
      `;

      const row = rows[0];

      if (!row) {
        throw new Error('Rate limit counter row not found');
      }

      let windowStartMs = row.windowStartAt.getTime();
      let requestCount = Number(row.requestCount);
      let blockedUntilMs = row.blockedUntil ? row.blockedUntil.getTime() : 0;

      if (blockedUntilMs > nowMs) {
        await tx.$executeRaw`
          UPDATE abuse_rate_limit_counters
          SET updated_at = ${nowAt}
          WHERE scope = ${input.scope}
            AND key_hash = ${keyHash}
        `;

        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((blockedUntilMs - nowMs) / 1000),
          ),
          resetAtUnix: Math.ceil(blockedUntilMs / 1000),
        };
      }

      if (nowMs - windowStartMs >= windowMs) {
        windowStartMs = nowMs;
        requestCount = 0;
        blockedUntilMs = 0;
      }

      if (requestCount >= input.policy.maxRequests) {
        const windowResetMs = windowStartMs + windowMs;
        const effectiveBlockedUntilMs =
          blockMs > 0 ? nowMs + blockMs : windowResetMs;
        blockedUntilMs = Math.max(effectiveBlockedUntilMs, windowResetMs);

        await tx.$executeRaw`
          UPDATE abuse_rate_limit_counters
          SET
            window_start_at = ${new Date(windowStartMs)},
            request_count = ${requestCount},
            blocked_until = ${new Date(blockedUntilMs)},
            updated_at = ${nowAt}
          WHERE scope = ${input.scope}
            AND key_hash = ${keyHash}
        `;

        return {
          allowed: false,
          remaining: 0,
          retryAfterSeconds: Math.max(
            1,
            Math.ceil((blockedUntilMs - nowMs) / 1000),
          ),
          resetAtUnix: Math.ceil(blockedUntilMs / 1000),
        };
      }

      requestCount += 1;

      await tx.$executeRaw`
        UPDATE abuse_rate_limit_counters
        SET
          window_start_at = ${new Date(windowStartMs)},
          request_count = ${requestCount},
          blocked_until = ${blockedUntilMs > 0 ? new Date(blockedUntilMs) : null},
          updated_at = ${nowAt}
        WHERE scope = ${input.scope}
          AND key_hash = ${keyHash}
      `;

      return {
        allowed: true,
        remaining: Math.max(0, input.policy.maxRequests - requestCount),
        retryAfterSeconds: 0,
        resetAtUnix: Math.ceil((windowStartMs + windowMs) / 1000),
      };
    });

    await this.tryCleanup(nowMs);

    return result;
  }

  private hashKey(key: string) {
    return createHash('sha256').update(key).digest('hex');
  }

  private async tryCleanup(nowMs: number) {
    const intervalMs = this.cleanupIntervalSeconds() * 1000;

    if (this.cleanupRunning || nowMs - this.lastCleanupAtMs < intervalMs) {
      return;
    }

    this.cleanupRunning = true;
    this.lastCleanupAtMs = nowMs;

    try {
      const retentionMs = this.retentionHours() * 60 * 60 * 1000;
      const staleBefore = new Date(nowMs - retentionMs);

      await this.prisma.$executeRaw`
        DELETE FROM abuse_rate_limit_counters
        WHERE updated_at < ${staleBefore}
      `;
    } catch (error) {
      this.logger.warn(
        `Failed to cleanup abuse counters: ${(error as Error).message}`,
      );
    } finally {
      this.cleanupRunning = false;
    }
  }

  private cleanupIntervalSeconds() {
    return (
      this.config.get<number>(
        'abuseProtection.postgres.cleanupIntervalSeconds',
      ) ?? 300
    );
  }

  private retentionHours() {
    return (
      this.config.get<number>('abuseProtection.postgres.retentionHours') ?? 48
    );
  }
}
