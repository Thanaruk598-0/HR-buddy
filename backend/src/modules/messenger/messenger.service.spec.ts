import { BadRequestException } from '@nestjs/common';
import { ActivityAction, RequestStatus, RequestType } from '@prisma/client';
import { MessengerService } from './messenger.service';

describe('MessengerService replay guard', () => {
  const tx = {
    magicLink: {
      findUnique: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      updateMany: jest.fn(),
    },
    requestActivityLog: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    request: {
      update: jest.fn(),
    },
  };

  const prisma = {
    $transaction: jest.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };

  const config = {
    get: jest.fn((key: string) => {
      if (key === 'messengerMagicLinkSecret') {
        return 'test-magic-link-secret-123456';
      }

      if (key === 'messengerMutationReplayWindowSeconds') {
        return 5;
      }

      return undefined;
    }),
  };

  const notificationsService = {
    notifyAdminProblemReported: jest.fn(),
    notifyEmployeeStatusChange: jest.fn(),
  };

  const service = new MessengerService(
    prisma as never,
    config as never,
    notificationsService as never,
  );

  const baseLink = {
    id: 'link-1',
    requestId: 'req-1',
    tokenHash: 'hash-1',
    expiresAt: new Date(Date.now() + 60_000),
    revokedAt: null,
    lastUsedAt: null,
    request: {
      id: 'req-1',
      requestNo: 'HRB-001',
      type: RequestType.MESSENGER,
      status: RequestStatus.APPROVED,
      phone: '+66811111111',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();

    tx.magicLink.findUnique.mockResolvedValue(baseLink);
    tx.magicLink.update.mockResolvedValue({ id: 'link-1' });
    tx.requestActivityLog.findFirst.mockResolvedValue(null);
    tx.requestActivityLog.create.mockResolvedValue({ id: 'log-1' });
    tx.request.update.mockResolvedValue({ id: 'req-1' });
    notificationsService.notifyAdminProblemReported.mockResolvedValue(
      undefined,
    );
    notificationsService.notifyEmployeeStatusChange.mockResolvedValue(
      undefined,
    );
  });

  const expectErrorCode = async (task: Promise<unknown>, code: string) => {
    try {
      await task;
      fail(`expected error code ${code}`);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code,
      });
    }
  };

  it('allows first reportProblem right after link access when no prior mutation exists', async () => {
    tx.magicLink.findUnique.mockResolvedValue({
      ...baseLink,
      lastUsedAt: new Date(Date.now() - 1_000),
    });

    const result = await service.reportProblem('token-abc', {
      note: 'Cannot contact receiver',
    });

    expect(result).toEqual({ ok: true });
    expect(tx.requestActivityLog.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        requestId: 'req-1',
        action: ActivityAction.REPORT_PROBLEM,
      }),
      select: expect.any(Object),
      orderBy: {
        createdAt: 'desc',
      },
    });
  });

  it('blocks reportProblem when recent same action already exists', async () => {
    tx.requestActivityLog.findFirst.mockResolvedValue({
      id: 'log-1',
      createdAt: new Date(Date.now() - 2_000),
    });

    await expectErrorCode(
      service.reportProblem('token-abc', { note: 'Cannot contact receiver' }),
      'MAGIC_LINK_REPLAY_BLOCKED',
    );

    expect(tx.requestActivityLog.create).not.toHaveBeenCalled();
  });

  it('blocks pickupEvent when recent same action already exists', async () => {
    tx.magicLink.findUnique.mockResolvedValue({
      ...baseLink,
      request: {
        ...baseLink.request,
        status: RequestStatus.IN_TRANSIT,
      },
    });
    tx.requestActivityLog.findFirst.mockResolvedValue({
      id: 'log-2',
      createdAt: new Date(Date.now() - 1_000),
    });

    await expectErrorCode(
      service.pickupEvent('token-abc', { note: 'Picked up' }),
      'MAGIC_LINK_REPLAY_BLOCKED',
    );

    expect(tx.requestActivityLog.create).not.toHaveBeenCalled();
  });
});
