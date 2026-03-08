import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  RateLimitConsumeInput,
  RateLimitConsumeResult,
} from './rate-limit.types';

type CounterEntry = {
  windowStartMs: number;
  count: number;
  blockedUntilMs: number;
  updatedAtMs: number;
};

@Injectable()
export class MemoryRateLimitStore {
  private readonly counters = new Map<string, CounterEntry>();

  constructor(private readonly config: ConfigService) {}

  async consume(input: RateLimitConsumeInput): Promise<RateLimitConsumeResult> {
    const nowMs = input.nowMs ?? Date.now();
    const windowMs = Math.max(1, input.policy.windowSeconds) * 1000;
    const blockMs = Math.max(0, input.policy.blockSeconds) * 1000;

    const mapKey = `${input.scope}:${input.key}`;

    const entry = this.counters.get(mapKey) ?? {
      windowStartMs: nowMs,
      count: 0,
      blockedUntilMs: 0,
      updatedAtMs: nowMs,
    };

    if (entry.blockedUntilMs > nowMs) {
      entry.updatedAtMs = nowMs;
      this.counters.set(mapKey, entry);

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((entry.blockedUntilMs - nowMs) / 1000),
        ),
        resetAtUnix: Math.ceil(entry.blockedUntilMs / 1000),
      };
    }

    if (nowMs - entry.windowStartMs >= windowMs) {
      entry.windowStartMs = nowMs;
      entry.count = 0;
      entry.blockedUntilMs = 0;
    }

    if (entry.count >= input.policy.maxRequests) {
      const windowResetMs = entry.windowStartMs + windowMs;
      const effectiveBlockedUntilMs =
        blockMs > 0 ? nowMs + blockMs : windowResetMs;

      entry.blockedUntilMs = Math.max(effectiveBlockedUntilMs, windowResetMs);
      entry.updatedAtMs = nowMs;
      this.counters.set(mapKey, entry);
      this.cleanup(nowMs);

      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(
          1,
          Math.ceil((entry.blockedUntilMs - nowMs) / 1000),
        ),
        resetAtUnix: Math.ceil(entry.blockedUntilMs / 1000),
      };
    }

    entry.count += 1;
    entry.updatedAtMs = nowMs;
    this.counters.set(mapKey, entry);
    this.cleanup(nowMs);

    return {
      allowed: true,
      remaining: Math.max(0, input.policy.maxRequests - entry.count),
      retryAfterSeconds: 0,
      resetAtUnix: Math.ceil((entry.windowStartMs + windowMs) / 1000),
    };
  }

  private cleanup(nowMs: number) {
    const maxEntries = this.maxEntries();

    if (this.counters.size <= maxEntries) {
      return;
    }

    const staleBeforeMs = nowMs - 6 * 60 * 60 * 1000;

    for (const [key, entry] of this.counters) {
      if (entry.updatedAtMs < staleBeforeMs) {
        this.counters.delete(key);
      }
    }

    while (this.counters.size > maxEntries) {
      const oldestKey = this.counters.keys().next().value as string | undefined;

      if (!oldestKey) {
        return;
      }

      this.counters.delete(oldestKey);
    }
  }

  private maxEntries() {
    return this.config.get<number>('abuseProtection.maxEntries') ?? 50000;
  }
}
