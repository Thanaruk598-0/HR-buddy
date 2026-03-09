import { BadRequestException } from '@nestjs/common';
import { AuthOtpService } from './auth-otp.service';
import { hashWithSecret } from './utils/crypto.util';

describe('AuthOtpService hardening', () => {
  const now = new Date('2026-03-08T10:00:00.000Z');

  const tx = {
    $queryRaw: jest.fn(),
    otpSession: {
      findFirst: jest.fn(),
      count: jest.fn(),
      create: jest.fn(),
      delete: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    employeeAccessSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  };

  const prisma = {
    otpSession: tx.otpSession,
    employeeAccessSession: tx.employeeAccessSession,
    $transaction: jest.fn(async (fn: (txArg: typeof tx) => Promise<unknown>) =>
      fn(tx),
    ),
  };

  const configValues: Record<string, unknown> = {
    otpHashSecret: 'very-strong-dev-secret',
    'otp.codeTtlMinutes': 5,
    'otp.sessionTtlMinutes': 30,
    'otp.maxAttempts': 5,
    'otp.sendCooldownSeconds': 60,
    'otp.maxSendPerHour': 6,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  };

  const sendOtpMock = jest.fn();

  const otpDeliveryService = {
    getProvider: jest.fn(() => ({ sendOtp: sendOtpMock })),
    isConsoleProvider: jest.fn(() => true),
  };

  let service: AuthOtpService;

  const expectErrorCode = async (task: Promise<unknown>, code: string) => {
    try {
      await task;
      fail(`expected error code ${code}`);
    } catch (error) {
      expect(error).toBeInstanceOf(Error);
      expect(
        (error as Error & { getResponse?: () => unknown }).getResponse?.(),
      ).toMatchObject({
        code,
      });
    }
  };

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(now);
    jest.clearAllMocks();

    tx.$queryRaw.mockResolvedValue([{ pg_advisory_xact_lock: null }]);
    tx.otpSession.findFirst.mockResolvedValue(null);
    tx.otpSession.count.mockResolvedValue(0);
    tx.otpSession.create.mockResolvedValue({ id: 'otp-1' });
    tx.otpSession.delete.mockResolvedValue({ id: 'otp-1' });
    tx.otpSession.update.mockResolvedValue({ id: 'otp-1' });
    tx.otpSession.updateMany.mockResolvedValue({ count: 1 });
    tx.employeeAccessSession.create.mockResolvedValue({ id: 'emp-sess-1' });
    sendOtpMock.mockResolvedValue(undefined);

    service = new AuthOtpService(
      prisma as never,
      config as never,
      otpDeliveryService as never,
    );
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('rejects sendOtp while cooldown is active', async () => {
    tx.otpSession.findFirst.mockResolvedValue({
      createdAt: new Date('2026-03-08T09:59:45.000Z'),
    });

    await expect(
      service.sendOtp({ phone: '+66811111111', email: 'employee@cl.local' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.otpSession.create).not.toHaveBeenCalled();
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('rejects sendOtp when hourly limit is reached', async () => {
    tx.otpSession.count.mockResolvedValue(6);

    await expect(
      service.sendOtp({ phone: '+66811111111', email: 'employee@cl.local' }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(tx.otpSession.create).not.toHaveBeenCalled();
    expect(sendOtpMock).not.toHaveBeenCalled();
  });

  it('deletes OTP session when delivery fails', async () => {
    sendOtpMock.mockRejectedValueOnce(new Error('delivery failed'));

    await expect(
      service.sendOtp({ phone: '+66811111111', email: 'employee@cl.local' }),
    ).rejects.toThrow('delivery failed');

    expect(tx.otpSession.create).toHaveBeenCalledTimes(1);
    expect(tx.otpSession.delete).toHaveBeenCalledWith({
      where: { id: 'otp-1' },
    });
  });

  it('creates OTP session and sends OTP when limits are not exceeded', async () => {
    const result = await service.sendOtp({
      phone: '+66811111111',
      email: 'employee@cl.local',
    });

    expect(tx.otpSession.create).toHaveBeenCalledTimes(1);
    expect(sendOtpMock).toHaveBeenCalledTimes(1);
    expect(result).toHaveProperty('expiresAt');
    expect(result).toHaveProperty('devOtp');
  });

  it('acquires advisory lock before issuing OTP', async () => {
    await service.sendOtp({
      phone: '+66811111111',
      email: 'employee@cl.local',
    });

    expect(tx.$queryRaw).toHaveBeenCalledTimes(1);
    expect(String((tx.$queryRaw as jest.Mock).mock.calls[0][0][0])).toContain(
      'pg_advisory_xact_lock',
    );
  });

  it('verifies OTP atomically and creates employee session', async () => {
    tx.otpSession.findFirst.mockResolvedValue({
      id: 'otp-verify-1',
      phone: '+66811111111',
      email: 'employee@cl.local',
      otpCodeHash: hashWithSecret('123456', 'very-strong-dev-secret'),
      expiresAt: new Date('2026-03-08T10:05:00.000Z'),
      verifiedAt: null,
      attemptCount: 0,
      createdAt: new Date('2026-03-08T10:00:00.000Z'),
    });

    const result = await service.verifyOtp({
      phone: '+66811111111',
      email: 'employee@cl.local',
      otpCode: '123456',
    });

    expect(result).toHaveProperty('sessionToken');
    expect(result).toHaveProperty('expiresAt');
    expect(tx.otpSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'otp-verify-1',
          verifiedAt: null,
          otpCodeHash: hashWithSecret('123456', 'very-strong-dev-secret'),
        }),
      }),
    );
    expect(tx.employeeAccessSession.create).toHaveBeenCalledTimes(1);
  });

  it('rejects OTP verify when code is invalid', async () => {
    tx.otpSession.findFirst.mockResolvedValue({
      id: 'otp-verify-1',
      phone: '+66811111111',
      email: 'employee@cl.local',
      otpCodeHash: hashWithSecret('123456', 'very-strong-dev-secret'),
      expiresAt: new Date('2026-03-08T10:05:00.000Z'),
      verifiedAt: null,
      attemptCount: 0,
      createdAt: new Date('2026-03-08T10:00:00.000Z'),
    });

    await expectErrorCode(
      service.verifyOtp({
        phone: '+66811111111',
        email: 'employee@cl.local',
        otpCode: '000000',
      }),
      'INVALID_OTP_CODE',
    );

    expect(tx.employeeAccessSession.create).not.toHaveBeenCalled();
  });

  it('rejects OTP verify when session was consumed concurrently', async () => {
    tx.otpSession.findFirst.mockResolvedValue({
      id: 'otp-verify-1',
      phone: '+66811111111',
      email: 'employee@cl.local',
      otpCodeHash: hashWithSecret('123456', 'very-strong-dev-secret'),
      expiresAt: new Date('2026-03-08T10:05:00.000Z'),
      verifiedAt: null,
      attemptCount: 0,
      createdAt: new Date('2026-03-08T10:00:00.000Z'),
    });
    tx.otpSession.updateMany.mockResolvedValue({ count: 0 });

    await expectErrorCode(
      service.verifyOtp({
        phone: '+66811111111',
        email: 'employee@cl.local',
        otpCode: '123456',
      }),
      'OTP_ALREADY_USED',
    );

    expect(tx.employeeAccessSession.create).not.toHaveBeenCalled();
  });
});
