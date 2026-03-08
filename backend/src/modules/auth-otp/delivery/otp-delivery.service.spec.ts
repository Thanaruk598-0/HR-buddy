import { ConfigService } from '@nestjs/config';
import { OtpConsoleDeliveryProvider } from './otp-console-delivery.provider';
import { OtpDeliveryService } from './otp-delivery.service';
import { OtpWebhookDeliveryProvider } from './otp-webhook-delivery.provider';

describe('OtpDeliveryService', () => {
  it('returns webhook provider when configured', () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'otp.deliveryProvider' ? 'webhook' : undefined,
      ),
    } as unknown as ConfigService;

    const consoleProvider = {} as OtpConsoleDeliveryProvider;
    const webhookProvider = {} as OtpWebhookDeliveryProvider;

    const svc = new OtpDeliveryService(
      config,
      consoleProvider,
      webhookProvider,
    );

    expect(svc.getProvider()).toBe(webhookProvider);
    expect(svc.isConsoleProvider()).toBe(false);
  });

  it('falls back to console provider', () => {
    const config = {
      get: jest.fn(() => undefined),
    } as unknown as ConfigService;

    const consoleProvider = {} as OtpConsoleDeliveryProvider;
    const webhookProvider = {} as OtpWebhookDeliveryProvider;

    const svc = new OtpDeliveryService(
      config,
      consoleProvider,
      webhookProvider,
    );

    expect(svc.getProvider()).toBe(consoleProvider);
    expect(svc.isConsoleProvider()).toBe(true);
  });
});
