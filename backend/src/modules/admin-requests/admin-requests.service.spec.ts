import { BadRequestException } from '@nestjs/common';
import { DeliveryMethod, RequestStatus, RequestType } from '@prisma/client';
import { AdminRequestsService } from './admin-requests.service';

describe('AdminRequestsService.updateStatus', () => {
  const tx = {
    request: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    operator: {
      findUnique: jest.fn(),
    },
    requestAttachment: {
      findUnique: jest.fn(),
    },
    documentRequestDetail: {
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
    createOrRotateMagicLinkForRequest: jest.fn(),
    revokeMagicLinkForRequest: jest.fn(),
  };

  const notificationsService = {
    notifyEmployeeStatusChange: jest.fn(),
  };

  const service = new AdminRequestsService(
    prisma as never,
    messengerService as never,
    notificationsService as never,
  );

  beforeEach(() => {
    jest.clearAllMocks();

    tx.operator.findUnique.mockResolvedValue({ id: 'op-1', isActive: true });
    tx.request.update.mockResolvedValue({ id: 'req-1' });
    tx.requestActivityLog.create.mockResolvedValue({ id: 'log-1' });
    tx.documentRequestDetail.update.mockResolvedValue({ requestId: 'req-1' });
    notificationsService.notifyEmployeeStatusChange.mockResolvedValue({
      id: 'notif-1',
    });
    messengerService.createOrRotateMagicLinkForRequest.mockResolvedValue({
      url: 'https://example.com/messenger/token-1',
      expiresAt: new Date('2030-01-01T10:00:00.000Z'),
    });
    messengerService.revokeMagicLinkForRequest.mockResolvedValue(undefined);
  });

  it('rejects invalid status transition for messenger', async () => {
    tx.request.findUnique.mockResolvedValue({
      type: RequestType.MESSENGER,
      status: RequestStatus.APPROVED,
      requestNo: 'HRB-1',
      phone: '+66811111111',
      documentRequestDetail: null,
    });

    try {
      await service.updateStatus('req-1', {
        status: RequestStatus.DONE,
        operatorId: 'op-1',
      });
      fail('expected updateStatus to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'INVALID_STATUS_TRANSITION',
      });
    }

    expect(tx.request.update).not.toHaveBeenCalled();
    expect(tx.requestActivityLog.create).not.toHaveBeenCalled();
  });

  it('rejects document done when DIGITAL has no file attachment', async () => {
    tx.request.findUnique.mockResolvedValue({
      type: RequestType.DOCUMENT,
      status: RequestStatus.APPROVED,
      requestNo: 'HRB-2',
      phone: '+66822222222',
      documentRequestDetail: {
        deliveryMethod: DeliveryMethod.DIGITAL,
        deliveryAddressId: null,
        digitalFileAttachmentId: null,
        pickupNote: null,
      },
    });

    try {
      await service.updateStatus('req-1', {
        status: RequestStatus.DONE,
        operatorId: 'op-1',
      });
      fail('expected updateStatus to throw');
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code: 'DIGITAL_FILE_REQUIRED_BEFORE_DONE',
      });
    }

    expect(tx.documentRequestDetail.update).not.toHaveBeenCalled();
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('updates document to DONE when DIGITAL has valid attachment', async () => {
    tx.request.findUnique.mockResolvedValue({
      type: RequestType.DOCUMENT,
      status: RequestStatus.APPROVED,
      requestNo: 'HRB-3',
      phone: '+66833333333',
      documentRequestDetail: {
        deliveryMethod: DeliveryMethod.DIGITAL,
        deliveryAddressId: null,
        digitalFileAttachmentId: null,
        pickupNote: null,
      },
    });

    tx.requestAttachment.findUnique.mockResolvedValue({
      id: 'att-1',
      requestId: 'req-1',
      fileKind: 'DOCUMENT',
    });

    const result = await service.updateStatus('req-1', {
      status: RequestStatus.DONE,
      operatorId: 'op-1',
      digitalFileAttachmentId: 'att-1',
    });

    expect(result).toEqual({
      id: 'req-1',
      status: RequestStatus.DONE,
    });

    expect(tx.documentRequestDetail.update).toHaveBeenCalledWith({
      where: { requestId: 'req-1' },
      data: {
        pickupNote: undefined,
        digitalFileAttachmentId: 'att-1',
      },
    });

    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: expect.objectContaining({
        status: RequestStatus.DONE,
        latestActivityAt: expect.any(Date),
        closedAt: expect.any(Date),
      }),
    });

    expect(tx.requestActivityLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        requestId: 'req-1',
        fromStatus: RequestStatus.APPROVED,
        toStatus: RequestStatus.DONE,
        actorRole: 'ADMIN',
        operatorId: 'op-1',
      }),
    });

    expect(
      notificationsService.notifyEmployeeStatusChange,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 'req-1',
        requestNo: 'HRB-3',
        phone: '+66833333333',
        status: RequestStatus.DONE,
      }),
      tx,
    );
  });

  it('returns magic link payload when messenger is approved', async () => {
    tx.request.findUnique.mockResolvedValue({
      type: RequestType.MESSENGER,
      status: RequestStatus.NEW,
      requestNo: 'HRB-4',
      phone: '+66844444444',
      documentRequestDetail: null,
    });

    const result = await service.updateStatus('req-1', {
      status: RequestStatus.APPROVED,
      operatorId: 'op-1',
    });

    expect(
      messengerService.createOrRotateMagicLinkForRequest,
    ).toHaveBeenCalledWith(tx, 'req-1');
    expect(messengerService.revokeMagicLinkForRequest).not.toHaveBeenCalled();

    expect(result).toEqual({
      id: 'req-1',
      status: RequestStatus.APPROVED,
      magicLink: {
        url: 'https://example.com/messenger/token-1',
        expiresAt: new Date('2030-01-01T10:00:00.000Z'),
      },
    });
  });

  it('revokes magic link when messenger reaches terminal status', async () => {
    tx.request.findUnique.mockResolvedValue({
      type: RequestType.MESSENGER,
      status: RequestStatus.IN_TRANSIT,
      requestNo: 'HRB-5',
      phone: '+66855555555',
      documentRequestDetail: null,
    });

    const result = await service.updateStatus('req-1', {
      status: RequestStatus.DONE,
      operatorId: 'op-1',
    });

    expect(result).toEqual({
      id: 'req-1',
      status: RequestStatus.DONE,
    });

    expect(
      messengerService.createOrRotateMagicLinkForRequest,
    ).not.toHaveBeenCalled();
    expect(messengerService.revokeMagicLinkForRequest).toHaveBeenCalledWith(
      tx,
      'req-1',
    );
  });
});
