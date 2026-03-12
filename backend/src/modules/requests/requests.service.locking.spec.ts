import { RequestStatus, RequestType } from '@prisma/client';
import { RequestsService } from './requests.service';

describe('RequestsService create lock', () => {
  const tx = {
    $queryRaw: jest.fn(),
    department: {
      findUnique: jest.fn(),
    },
    request: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    requestActivityLog: {
      create: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };

  const messengerService = {
    revokeMagicLinkForRequest: jest.fn(),
  };

  const notificationsService = {
    notifyAdminRequestCanceled: jest.fn(),
  };

  const buildService = (useDbLock: boolean) => {
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'requestCreateUseDbLock') {
          return useDbLock;
        }

        if (key === 'requestDedupeWindowSeconds') {
          return 30;
        }

        return undefined;
      }),
    };

    return new RequestsService(
      prisma as never,
      messengerService as never,
      notificationsService as never,
      { next: jest.fn(async () => 'HRB-20260308-0001') } as never,
      config as never,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();

    tx.$queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    tx.department.findUnique.mockResolvedValue({ id: 'dept-1' });
    tx.request.findUnique.mockResolvedValue({
      id: 'req-1',
      requestNo: 'HRB-20260308-0001',
      type: RequestType.BUILDING,
      status: RequestStatus.NEW,
      phone: '+66811111111',
    });
    tx.request.findMany.mockResolvedValue([]);
    tx.request.create.mockResolvedValue({
      id: 'req-1',
      requestNo: 'HRB-20260308-0001',
      status: 'NEW',
      employeeName: 'John',
    });
    tx.request.update.mockResolvedValue({ id: 'req-1' });
    tx.requestActivityLog.create.mockResolvedValue({ id: 'log-1' });
    notificationsService.notifyAdminRequestCanceled.mockResolvedValue({
      id: 'notif-1',
    });
    messengerService.revokeMagicLinkForRequest.mockResolvedValue(undefined);
  });

  it('acquires advisory lock before dedupe check when enabled', async () => {
    const service = buildService(true);

    await (service as any).createRequestCore({
      type: RequestType.BUILDING,
      urgency: 'NORMAL',
      employeeName: 'John',
      departmentId: 'dept-1',
      phone: '+66811111111',
      dedupeMatcher: () => false,
      detailCreator: async () => {
        return;
      },
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);

    const lockCall = tx.$queryRaw.mock.calls[0];
    expect(String(lockCall[0][0])).toContain('pg_advisory_xact_lock');
  });

  it('skips advisory lock when disabled', async () => {
    const service = buildService(false);

    await (service as any).createRequestCore({
      type: RequestType.BUILDING,
      urgency: 'NORMAL',
      employeeName: 'John',
      departmentId: 'dept-1',
      phone: '+66811111111',
      dedupeMatcher: () => false,
      detailCreator: async () => {
        return;
      },
    });

    expect(tx.$queryRaw).not.toHaveBeenCalled();
  });

  it('acquires advisory lock before cancel mutation', async () => {
    const service = buildService(true);

    await service.cancelRequest('req-1', '+66811111111', 'Duplicate request');

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(String((tx.$queryRaw as jest.Mock).mock.calls[0][0][0])).toContain(
      'pg_advisory_xact_lock',
    );
  });
});
