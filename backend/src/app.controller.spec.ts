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

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'health.checkToken') {
        return 'health-token-1234567890';
      }

      return undefined;
    }),
  } as unknown as ConfigService;

  let controller: AppController;
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
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

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('does not require health token outside production', async () => {
    process.env.NODE_ENV = 'development';

    await expect(controller.healthDb(undefined)).resolves.toEqual({
      ok: true,
      db: true,
    });
  });

  it('rejects health endpoint in production when token is invalid', async () => {
    process.env.NODE_ENV = 'production';

    await expect(controller.healthDb('wrong-token')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('returns sanitized readiness payload in production', async () => {
    process.env.NODE_ENV = 'production';

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
    process.env.NODE_ENV = 'production';
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
