import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MemoryRateLimitStore } from './memory-rate-limit.store';
import { PostgresRateLimitStore } from './postgres-rate-limit.store';
import { AbuseProtectionService } from './abuse-protection.service';

describe('AbuseProtectionService', () => {
  let configGetMock: jest.Mock;
  let memoryStore: jest.Mocked<MemoryRateLimitStore>;
  let postgresStore: jest.Mocked<PostgresRateLimitStore>;
  let service: AbuseProtectionService;

  beforeEach(() => {
    configGetMock = jest.fn((key: string) => {
      if (key === 'abuseProtection.store') {
        return 'memory';
      }

      if (key === 'abuseProtection.postgres.retryAfterSeconds') {
        return 30;
      }

      if (key === 'abuseProtection.postgres.failClosedInProduction') {
        return false;
      }

      if (key === 'runtimeEnv') {
        return 'development';
      }

      return undefined;
    });

    memoryStore = {
      consume: jest.fn(async () => ({
        allowed: true,
        remaining: 1,
        retryAfterSeconds: 0,
        resetAtUnix: 1_700_000_000,
      })),
    } as unknown as jest.Mocked<MemoryRateLimitStore>;

    postgresStore = {
      consume: jest.fn(async () => ({
        allowed: true,
        remaining: 2,
        retryAfterSeconds: 0,
        resetAtUnix: 1_700_000_100,
      })),
    } as unknown as jest.Mocked<PostgresRateLimitStore>;

    service = new AbuseProtectionService(
      { get: configGetMock } as unknown as ConfigService,
      memoryStore,
      postgresStore,
    );
  });

  it('uses memory store when configured', async () => {
    const result = await service.consume({
      scope: 'otpSend',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 60, maxRequests: 5, blockSeconds: 300 },
      nowMs: 1_000,
    });

    expect(memoryStore.consume).toHaveBeenCalledTimes(1);
    expect(postgresStore.consume).not.toHaveBeenCalled();
    expect(result.remaining).toBe(1);
  });

  it('uses postgres store when configured', async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === 'abuseProtection.store') {
        return 'postgres';
      }

      if (key === 'abuseProtection.postgres.retryAfterSeconds') {
        return 30;
      }

      if (key === 'abuseProtection.postgres.failClosedInProduction') {
        return false;
      }

      if (key === 'runtimeEnv') {
        return 'development';
      }

      return undefined;
    });

    const result = await service.consume({
      scope: 'adminLogin',
      key: 'ip=1.1.1.1:username=admin',
      policy: { windowSeconds: 60, maxRequests: 10, blockSeconds: 600 },
      nowMs: 1_000,
    });

    expect(postgresStore.consume).toHaveBeenCalledTimes(1);
    expect(memoryStore.consume).not.toHaveBeenCalled();
    expect(result.remaining).toBe(2);
  });

  it('falls back to memory when postgres store fails outside production', async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === 'abuseProtection.store') {
        return 'postgres';
      }

      if (key === 'abuseProtection.postgres.retryAfterSeconds') {
        return 30;
      }

      if (key === 'abuseProtection.postgres.failClosedInProduction') {
        return true;
      }

      if (key === 'runtimeEnv') {
        return 'development';
      }

      return undefined;
    });

    postgresStore.consume.mockRejectedValueOnce(new Error('relation missing'));

    const first = await service.consume({
      scope: 'otpVerify',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 60, maxRequests: 10, blockSeconds: 300 },
      nowMs: 1_000,
    });

    const second = await service.consume({
      scope: 'otpVerify',
      key: 'ip=1.1.1.1',
      policy: { windowSeconds: 60, maxRequests: 10, blockSeconds: 300 },
      nowMs: 2_000,
    });

    expect(postgresStore.consume).toHaveBeenCalledTimes(1);
    expect(memoryStore.consume).toHaveBeenCalledTimes(2);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
  });

  it('falls back to memory when postgres store fails in production and fail-closed is disabled', async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === 'abuseProtection.store') {
        return 'postgres';
      }

      if (key === 'abuseProtection.postgres.retryAfterSeconds') {
        return 30;
      }

      if (key === 'abuseProtection.postgres.failClosedInProduction') {
        return false;
      }

      if (key === 'runtimeEnv') {
        return 'production';
      }

      return undefined;
    });

    postgresStore.consume.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(
      service.consume({
        scope: 'otpVerify',
        key: 'ip=1.1.1.1',
        policy: { windowSeconds: 60, maxRequests: 10, blockSeconds: 300 },
        nowMs: 1_000,
      }),
    ).resolves.toMatchObject({
      allowed: true,
      remaining: 1,
    });

    expect(memoryStore.consume).toHaveBeenCalledTimes(1);
  });

  it('fails closed when postgres store fails in production and fail-closed is enabled', async () => {
    configGetMock.mockImplementation((key: string) => {
      if (key === 'abuseProtection.store') {
        return 'postgres';
      }

      if (key === 'abuseProtection.postgres.retryAfterSeconds') {
        return 30;
      }

      if (key === 'abuseProtection.postgres.failClosedInProduction') {
        return true;
      }

      if (key === 'runtimeEnv') {
        return 'production';
      }

      return undefined;
    });

    postgresStore.consume.mockRejectedValueOnce(new Error('db unavailable'));

    await expect(
      service.consume({
        scope: 'otpVerify',
        key: 'ip=1.1.1.1',
        policy: { windowSeconds: 60, maxRequests: 10, blockSeconds: 300 },
        nowMs: 1_000,
      }),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);

    expect(memoryStore.consume).not.toHaveBeenCalled();
  });
});
