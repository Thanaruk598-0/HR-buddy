import { Injectable, Logger } from '@nestjs/common';
import {
  OtpDeliveryPayload,
  OtpDeliveryProvider,
} from './otp-delivery.interface';

@Injectable()
export class OtpConsoleDeliveryProvider implements OtpDeliveryProvider {
  private readonly logger = new Logger(OtpConsoleDeliveryProvider.name);

  async sendOtp(payload: OtpDeliveryPayload): Promise<void> {
    this.logger.log(
      `OTP code=${payload.otpCode} phone=${payload.phone} email=${payload.email} expiresAt=${payload.expiresAt.toISOString()}`,
    );
  }
}
