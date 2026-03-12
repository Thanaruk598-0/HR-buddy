import { BadRequestException } from '@nestjs/common';
import { DeliveryMethod, RequestStatus, RequestType } from '@prisma/client';
import { AdminRequestsService } from './admin-requests.service';

describe('AdminRequestsService.updateStatus', () => {
  const tx = {
    $queryRaw: jest.fn(),
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

  const makeRequest = (overrides: Record<string, unknown> = {}) => ({
    type: RequestType.BUILDING,
    status: RequestStatus.NEW,
    requestNo: 'HRB-BASE',
    phone: '+66810000000',
    documentRequestDetail: null,
    ...overrides,
  });

  const makeDocumentDetail = (overrides: Record<string, unknown> = {}) => ({
    deliveryMethod: DeliveryMethod.DIGITAL,
    deliveryAddressId: null,
    digitalFileAttachmentId: null,
    pickupNote: null,
    ...overrides,
  });

  const expectBadRequestCode = async (task: Promise<unknown>, code: string) => {
    try {
      await task;
      fail(`expected BadRequestException with code ${code}`);
    } catch (error) {
      expect(error).toBeInstanceOf(BadRequestException);
      expect((error as BadRequestException).getResponse()).toMatchObject({
        code,
      });
    }
  };

  beforeEach(() => {
    jest.clearAllMocks();

    tx.$queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    tx.operator.findUnique.mockResolvedValue({
      id: 'op-1',
      isActive: true,
      displayName: 'Operator 1',
    });
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

  it('acquires request mutation lock before status update', async () => {
    tx.request.findUnique.mockResolvedValue(makeRequest());

    await service.updateStatus('req-1', {
      status: RequestStatus.APPROVED,
      operatorId: 'op-1',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(String((tx.$queryRaw as jest.Mock).mock.calls[0][0][0])).toContain(
      'pg_advisory_xact_lock',
    );
  });
  it('rejects invalid status transition for messenger', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.MESSENGER,
        status: RequestStatus.APPROVED,
      }),
    );

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.DONE,
        operatorId: 'op-1',
      }),
      'INVALID_STATUS_TRANSITION',
    );

    expect(tx.request.update).not.toHaveBeenCalled();
    expect(tx.requestActivityLog.create).not.toHaveBeenCalled();
  });

  it('rejects when operator id is invalid', async () => {
    tx.request.findUnique.mockResolvedValue(makeRequest());
    tx.operator.findUnique.mockResolvedValue(null);

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.APPROVED,
        operatorId: 'op-missing',
      }),
      'INVALID_OPERATOR_ID',
    );

    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('rejects when operator id is blank after trimming', async () => {
    tx.request.findUnique.mockResolvedValue(makeRequest());

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.APPROVED,
        operatorId: '   ',
      }),
      'INVALID_OPERATOR_ID',
    );

    expect(tx.operator.findUnique).not.toHaveBeenCalled();
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('rejects when operator is inactive', async () => {
    tx.request.findUnique.mockResolvedValue(makeRequest());
    tx.operator.findUnique.mockResolvedValue({
      id: 'op-inactive',
      isActive: false,
    });

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.APPROVED,
        operatorId: 'op-inactive',
      }),
      'OPERATOR_INACTIVE',
    );

    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('requires note for REJECTED action', async () => {
    tx.request.findUnique.mockResolvedValue(makeRequest());

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.REJECTED,
        operatorId: 'op-1',
      }),
      'NOTE_REQUIRED_FOR_ACTION',
    );

    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('rejects document action when detail is missing', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.DOCUMENT,
        status: RequestStatus.NEW,
        documentRequestDetail: null,
      }),
    );

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.APPROVED,
        operatorId: 'op-1',
      }),
      'DOCUMENT_DETAIL_NOT_FOUND',
    );
  });

  it('rejects document APPROVED when POSTAL has no delivery address', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.DOCUMENT,
        status: RequestStatus.NEW,
        documentRequestDetail: makeDocumentDetail({
          deliveryMethod: DeliveryMethod.POSTAL,
          deliveryAddressId: null,
        }),
      }),
    );

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.APPROVED,
        operatorId: 'op-1',
      }),
      'DELIVERY_ADDRESS_REQUIRED_BEFORE_APPROVED',
    );
  });

  it('rejects document DONE when DIGITAL has no file attachment', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.DOCUMENT,
        status: RequestStatus.APPROVED,
        requestNo: 'HRB-2',
        phone: '+66822222222',
        documentRequestDetail: makeDocumentDetail({
          deliveryMethod: DeliveryMethod.DIGITAL,
          digitalFileAttachmentId: null,
        }),
      }),
    );

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.DONE,
        operatorId: 'op-1',
      }),
      'DIGITAL_FILE_REQUIRED_BEFORE_DONE',
    );

    expect(tx.documentRequestDetail.update).not.toHaveBeenCalled();
    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('rejects invalid digital file attachment id', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.DOCUMENT,
        status: RequestStatus.APPROVED,
        documentRequestDetail: makeDocumentDetail({
          deliveryMethod: DeliveryMethod.DIGITAL,
        }),
      }),
    );

    tx.requestAttachment.findUnique.mockResolvedValue(null);

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.DONE,
        operatorId: 'op-1',
        digitalFileAttachmentId: 'att-missing',
      }),
      'INVALID_DIGITAL_FILE_ATTACHMENT_ID',
    );

    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('rejects digital file attachment when file kind is not DOCUMENT', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.DOCUMENT,
        status: RequestStatus.APPROVED,
        documentRequestDetail: makeDocumentDetail({
          deliveryMethod: DeliveryMethod.DIGITAL,
        }),
      }),
    );

    tx.requestAttachment.findUnique.mockResolvedValue({
      id: 'att-image',
      requestId: 'req-1',
      fileKind: 'IMAGE',
    });

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.DONE,
        operatorId: 'op-1',
        digitalFileAttachmentId: 'att-image',
      }),
      'DIGITAL_FILE_ATTACHMENT_MUST_BE_DOCUMENT',
    );
  });

  it('rejects document DONE when PICKUP has no pickup note', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.DOCUMENT,
        status: RequestStatus.APPROVED,
        documentRequestDetail: makeDocumentDetail({
          deliveryMethod: DeliveryMethod.PICKUP,
          pickupNote: null,
        }),
      }),
    );

    await expectBadRequestCode(
      service.updateStatus('req-1', {
        status: RequestStatus.DONE,
        operatorId: 'op-1',
        pickupNote: '   ',
      }),
      'PICKUP_NOTE_REQUIRED_BEFORE_DONE',
    );

    expect(tx.request.update).not.toHaveBeenCalled();
  });

  it('updates document to DONE when DIGITAL has valid attachment', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.DOCUMENT,
        status: RequestStatus.APPROVED,
        requestNo: 'HRB-3',
        phone: '+66833333333',
        documentRequestDetail: makeDocumentDetail({
          deliveryMethod: DeliveryMethod.DIGITAL,
        }),
      }),
    );

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

  it('updates document to DONE when PICKUP has trimmed pickup note', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.DOCUMENT,
        status: RequestStatus.APPROVED,
        documentRequestDetail: makeDocumentDetail({
          deliveryMethod: DeliveryMethod.PICKUP,
          pickupNote: null,
        }),
      }),
    );

    const result = await service.updateStatus('req-1', {
      status: RequestStatus.DONE,
      operatorId: 'op-1',
      pickupNote: '  Pick at HR counter 13:00  ',
    });

    expect(result).toEqual({
      id: 'req-1',
      status: RequestStatus.DONE,
    });

    expect(tx.documentRequestDetail.update).toHaveBeenCalledWith({
      where: { requestId: 'req-1' },
      data: {
        pickupNote: 'Pick at HR counter 13:00',
        digitalFileAttachmentId: undefined,
      },
    });
  });

  it('returns magic link payload when messenger is approved', async () => {
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.MESSENGER,
        status: RequestStatus.NEW,
        requestNo: 'HRB-4',
        phone: '+66844444444',
      }),
    );

    const result = await service.updateStatus('req-1', {
      status: RequestStatus.APPROVED,
      operatorId: 'op-1',
    });

    expect(
      messengerService.createOrRotateMagicLinkForRequest,
    ).toHaveBeenCalledWith(tx, 'req-1');
    expect(messengerService.revokeMagicLinkForRequest).not.toHaveBeenCalled();

    expect(tx.request.update).toHaveBeenCalledWith({
      where: { id: 'req-1' },
      data: expect.objectContaining({
        status: RequestStatus.APPROVED,
        closedAt: null,
      }),
    });

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
    tx.request.findUnique.mockResolvedValue(
      makeRequest({
        type: RequestType.MESSENGER,
        status: RequestStatus.IN_TRANSIT,
        requestNo: 'HRB-5',
        phone: '+66855555555',
      }),
    );

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
