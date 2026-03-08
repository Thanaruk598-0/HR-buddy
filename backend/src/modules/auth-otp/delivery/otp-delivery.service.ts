import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpConsoleDeliveryProvider } from './otp-console-delivery.provider';
import { OtpDeliveryProvider } from './otp-delivery.interface';
import { OtpWebhookDeliveryProvider } from './otp-webhook-delivery.provider';

@Injectable()
export class OtpDeliveryService {
  constructor(
    private readonly config: ConfigService,
    private readonly consoleProvider: OtpConsoleDeliveryProvider,
    private readonly webhookProvider: OtpWebhookDeliveryProvider,
  ) {}

  getProvider(): OtpDeliveryProvider {
    const provider =
      this.config.get<string>('otp.deliveryProvider') ?? 'console';

    if (provider === 'webhook') {
      return this.webhookProvider;
    }

    return this.consoleProvider;
  }

  isConsoleProvider() {
    const provider =
      this.config.get<string>('otp.deliveryProvider') ?? 'console';
    return provider === 'console';
  }
}
