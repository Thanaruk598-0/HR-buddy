import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  OtpDeliveryPayload,
  OtpDeliveryProvider,
} from './otp-delivery.interface';

@Injectable()
export class OtpWebhookDeliveryProvider implements OtpDeliveryProvider {
  private readonly logger = new Logger(OtpWebhookDeliveryProvider.name);

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
    const maxRetries = this.config.get<number>('otp.webhookMaxRetries') ?? 2;
    const retryDelayMs = this.config.get<number>('otp.webhookRetryDelayMs') ?? 200;

    const requestBody = {
      channel: 'email',
      phone: payload.phone,
      email: payload.email,
      otpCode: payload.otpCode,
      expiresAt: payload.expiresAt.toISOString(),
    };

    for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
      const attemptNumber = attempt + 1;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
          },
          body: JSON.stringify(requestBody),
          signal: controller.signal,
        });

        if (response.ok) {
          return;
        }

        const shouldRetry =
          this.isRetryableStatus(response.status) && attempt < maxRetries;

        if (shouldRetry) {
          this.logger.warn(
            `OTP webhook failed with status ${response.status}; retrying attempt ${attemptNumber}/${maxRetries + 1}`,
          );

          await this.wait(retryDelayMs * attemptNumber);
          continue;
        }

        throw new ServiceUnavailableException({
          code: 'OTP_DELIVERY_FAILED',
          message: 'OTP delivery provider returned a non-success response',
          statusCode: response.status,
        });
      } catch (error) {
        if (error instanceof ServiceUnavailableException) {
          throw error;
        }

        const isLastAttempt = attempt >= maxRetries;

        if (!isLastAttempt) {
          this.logger.warn(
            `OTP webhook call failed; retrying attempt ${attemptNumber}/${maxRetries + 1}`,
          );
          await this.wait(retryDelayMs * attemptNumber);
          continue;
        }

        throw new ServiceUnavailableException({
          code: 'OTP_DELIVERY_FAILED',
          message: 'Failed to deliver OTP',
        });
      } finally {
        clearTimeout(timeout);
      }
    }

    throw new ServiceUnavailableException({
      code: 'OTP_DELIVERY_FAILED',
      message: 'Failed to deliver OTP',
    });
  }

  private isRetryableStatus(statusCode: number) {
    return statusCode === 429 || statusCode >= 500;
  }

  private async wait(ms: number) {
    if (ms <= 0) {
      return;
    }

    await new Promise<void>((resolve) => {
      setTimeout(resolve, ms);
    });
  }
}
