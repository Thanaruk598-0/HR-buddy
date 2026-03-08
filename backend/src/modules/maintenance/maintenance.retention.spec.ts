import { MaintenanceService } from './maintenance.service';

describe('MaintenanceService retention db lock', () => {
  const now = new Date('2026-03-08T11:00:00.000Z');

  const prisma = {
    $queryRaw: jest.fn(),
    $transaction: jest.fn(async (ops: unknown[]) =>
      Promise.all(ops as Promise<unknown>[]),
    ),
    otpSession: {
      deleteMany: jest.fn(),
    },
    employeeAccessSession: {
      deleteMany: jest.fn(),
    },
    notification: {
      deleteMany: jest.fn(),
    },
    requestActivityLog: {
      deleteMany: jest.fn(),
    },
  };

  const configValues: Record<string, unknown> = {
    'retention.useDbLock': true,
    'retention.dbLockKey': 48151623,
    'retention.otpSessionsDays': 7,
    'retention.employeeSessionsDays': 7,
    'retention.notificationsDays': 180,
    'retention.activityLogsDays': 365,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  let service: MaintenanceService;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();

    prisma.otpSession.deleteMany.mockResolvedValue({ count: 1 });
    prisma.employeeAccessSession.deleteMany.mockResolvedValue({ count: 2 });
    prisma.notification.deleteMany.mockResolvedValue({ count: 3 });
    prisma.requestActivityLog.deleteMany.mockResolvedValue({ count: 4 });

    service = new MaintenanceService(prisma as never, config as never);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('skips retention run when db lock is held by another instance', async () => {
    prisma.$queryRaw.mockResolvedValueOnce([{ acquired: false }]);

    const result = await service.runRetentionJob('manual');

    expect(result.skipped).toBe(true);
    expect(result.deleted).toEqual({
      otpSessions: 0,
      employeeSessions: 0,
      notifications: 0,
      activityLogs: 0,
    });

    expect(prisma.otpSession.deleteMany).not.toHaveBeenCalled();
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(1);
  });

  it('runs retention job and releases db lock when acquired', async () => {
    prisma.$queryRaw
      .mockResolvedValueOnce([{ acquired: true }])
      .mockResolvedValueOnce([{ pg_advisory_unlock: true }]);

    const result = await service.runRetentionJob('manual');

    expect(result.skipped).toBe(false);
    expect(result.deleted).toEqual({
      otpSessions: 1,
      employeeSessions: 2,
      notifications: 3,
      activityLogs: 4,
    });

    expect(prisma.otpSession.deleteMany).toHaveBeenCalledTimes(1);
    expect(prisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('runs retention job without lock queries when db lock is disabled', async () => {
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'retention.useDbLock') {
        return false;
      }

      return configValues[key];
    });

    const result = await service.runRetentionJob('manual');

    expect(result.skipped).toBe(false);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(prisma.otpSession.deleteMany).toHaveBeenCalledTimes(1);
  });
});
