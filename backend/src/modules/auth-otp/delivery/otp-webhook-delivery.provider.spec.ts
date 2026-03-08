import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpWebhookDeliveryProvider } from './otp-webhook-delivery.provider';

describe('OtpWebhookDeliveryProvider', () => {
  const payload = {
    phone: '+66811111111',
    email: 'employee@cl.local',
    otpCode: '123456',
    expiresAt: new Date('2030-01-01T00:05:00.000Z'),
  };

  const configValues: Record<string, unknown> = {
    'otp.webhookUrl': 'https://example.com/otp',
    'otp.webhookApiKey': 'secret',
    'otp.webhookTimeoutMs': 5000,
    'otp.webhookMaxRetries': 2,
    'otp.webhookRetryDelayMs': 0,
  };

  const config = {
    get: jest.fn((key: string) => configValues[key]),
  } as unknown as ConfigService;

  let provider: OtpWebhookDeliveryProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    provider = new OtpWebhookDeliveryProvider(config);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('retries on retryable status and succeeds', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 503 } as Response)
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    await provider.sendOtp(payload);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('does not retry on non-retryable status', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: false, status: 400 } as Response);

    await expect(provider.sendOtp(payload)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('retries on network error and succeeds', async () => {
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce({ ok: true, status: 200 } as Response);

    await provider.sendOtp(payload);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('throws when webhook URL is missing', async () => {
    (config.get as jest.Mock).mockImplementation((key: string) => {
      if (key === 'otp.webhookUrl') {
        return null;
      }
      return configValues[key];
    });

    await expect(provider.sendOtp(payload)).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
  });
});
