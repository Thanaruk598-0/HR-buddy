import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryRateLimitStore } from './memory-rate-limit.store';
import { PostgresRateLimitStore } from './postgres-rate-limit.store';
import {
  AbuseProtectionStoreName,
  RateLimitConsumeInput,
  RateLimitConsumeResult,
} from './rate-limit.types';

@Injectable()
export class AbuseProtectionService {
  private readonly logger = new Logger(AbuseProtectionService.name);
  private postgresDisabledUntilMs = 0;

  constructor(
    private readonly config: ConfigService,
    private readonly memoryStore: MemoryRateLimitStore,
    private readonly postgresStore: PostgresRateLimitStore,
  ) {}

  async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
    const preferredStore = this.storeName();

    if (preferredStore === 'postgres') {
      const nowMs = Date.now();

      if (nowMs < this.postgresDisabledUntilMs) {
        return this.memoryStore.consume(input);
      }

      try {
        return await this.postgresStore.consume(input);
      } catch (error) {
        const retryAfterSeconds = this.postgresRetryAfterSeconds();
        this.postgresDisabledUntilMs = nowMs + retryAfterSeconds * 1000;

        this.logger.warn(
          `Postgres abuse store failed. Fallback to memory for ${retryAfterSeconds}s: ${(error as Error).message}`,
        );

        return this.memoryStore.consume(input);
      }
    }

    return this.memoryStore.consume(input);
  }

  private storeName(): AbuseProtectionStoreName {
    const configured = this.config.get<string>('abuseProtection.store');

    if (configured === 'postgres') {
      return 'postgres';
    }

    return 'memory';
  }

  private postgresRetryAfterSeconds() {
    return (
      this.config.get<number>('abuseProtection.postgres.retryAfterSeconds') ??
      30
    );
  }
}
