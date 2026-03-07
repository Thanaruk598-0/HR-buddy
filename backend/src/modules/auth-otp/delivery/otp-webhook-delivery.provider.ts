import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OtpDeliveryPayload,
  OtpDeliveryProvider,
} from './otp-delivery.interface';

@Injectable()
export class OtpWebhookDeliveryProvider implements OtpDeliveryProvider {
  constructor(private readonly config: ConfigService) {}

  async sendOtp(payload: OtpDeliveryPayload): Promise<void> {
    const url = this.config.get<string>('otp.webhookUrl');

    if (!url) {
      throw new ServiceUnavailableException({
        code: 'OTP_DELIVERY_WEBHOOK_URL_MISSING',
        message: 'OTP delivery provider is not configured',
      });
    }

    const apiKey = this.config.get<string>('otp.webhookApiKey');
    const timeoutMs = this.config.get<number>('otp.webhookTimeoutMs') ?? 5000;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
        },
        body: JSON.stringify({
          channel: 'email',
          phone: payload.phone,
          email: payload.email,
          otpCode: payload.otpCode,
          expiresAt: payload.expiresAt.toISOString(),
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new ServiceUnavailableException({
          code: 'OTP_DELIVERY_FAILED',
          message: 'OTP delivery provider returned a non-success response',
          statusCode: response.status,
        });
      }
    } catch (error) {
      if (error instanceof ServiceUnavailableException) {
        throw error;
      }

      throw new ServiceUnavailableException({
        code: 'OTP_DELIVERY_FAILED',
        message: 'Failed to deliver OTP',
      });
    } finally {
      clearTimeout(timeout);
    }
  }
}
