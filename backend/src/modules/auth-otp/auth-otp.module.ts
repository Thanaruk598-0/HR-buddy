import { Module } from '@nestjs/common';
import { AuthOtpController } from './auth-otp.controller';
import { AuthOtpService } from './auth-otp.service';
import { OtpConsoleDeliveryProvider } from './delivery/otp-console-delivery.provider';
import { OtpDeliveryService } from './delivery/otp-delivery.service';
import { OtpWebhookDeliveryProvider } from './delivery/otp-webhook-delivery.provider';
import { EmployeeSessionGuard } from './employee-session.guard';

@Module({
  controllers: [AuthOtpController],
  providers: [
    AuthOtpService,
    OtpDeliveryService,
    OtpConsoleDeliveryProvider,
    OtpWebhookDeliveryProvider,
    EmployeeSessionGuard,
  ],
  exports: [AuthOtpService, EmployeeSessionGuard],
})
export class AuthOtpModule {}
