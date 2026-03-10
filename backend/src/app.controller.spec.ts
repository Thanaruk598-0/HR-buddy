import {
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppController } from './app.controller';
import { ReadinessService } from './health/readiness.service';
import { PrismaService } from './prisma/prisma.service';

describe('AppController health access', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  const readinessService = {
    getReport: jest.fn(),
  } as unknown as ReadinessService;

  const configValues: Record<string, unknown> = {
    runtimeEnv: 'development',
    'health.checkToken': 'health-token-1234567890',
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  let controller: AppController;

  beforeEach(() => {
    jest.clearAllMocks();
    configValues.runtimeEnv = 'development';
    prisma.$queryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);
    readinessService.getReport = jest.fn().mockResolvedValue({
      ok: true,
      checkedAt: '2026-03-10T00:00:00.000Z',
      checks: [
        {
          name: 'database',
          ok: true,
          message: 'database connection is healthy',
        },
      ],
    });

    controller = new AppController(prisma, readinessService, config);
  });

  it('does not require health token outside production', async () => {
    configValues.runtimeEnv = 'development';

    await expect(controller.healthDb(undefined)).resolves.toEqual({
      ok: true,
      db: true,
    });
  });

  it('rejects health endpoint in production when token is invalid', async () => {
    configValues.runtimeEnv = 'production';

    await expect(controller.healthDb('wrong-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns sanitized readiness payload in production', async () => {
    configValues.runtimeEnv = 'production';

    const result = await controller.healthReady('health-token-1234567890');

    expect(result).toEqual({
      ok: true,
      checkedAt: '2026-03-10T00:00:00.000Z',
      checks: [
        {
          name: 'database',
          ok: true,
          skipped: undefined,
        },
      ],
    });
  });

  it('throws ServiceUnavailableException with sanitized report when readiness fails', async () => {
    configValues.runtimeEnv = 'production';
    readinessService.getReport = jest.fn().mockResolvedValue({
      ok: false,
      checkedAt: '2026-03-10T00:00:00.000Z',
      checks: [
        {
          name: 'otp-provider',
          ok: false,
          message: 'OTP provider missing',
        },
      ],
    });

    try {
      await controller.healthReady('health-token-1234567890');
      fail('expected readiness failure');
    } catch (error) {
      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getResponse()).toEqual({
        ok: false,
        checkedAt: '2026-03-10T00:00:00.000Z',
        checks: [
          {
            name: 'otp-provider',
            ok: false,
            skipped: undefined,
          },
        ],
      });
    }
  });
});
