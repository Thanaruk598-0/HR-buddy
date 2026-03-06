import { Module } from '@nestjs/common';
import { AuthOtpController } from './auth-otp.controller';
import { AuthOtpService } from './auth-otp.service';
import { EmployeeSessionGuard } from './employee-session.guard';

@Module({
  controllers: [AuthOtpController],
  providers: [AuthOtpService, EmployeeSessionGuard],
  exports: [AuthOtpService, EmployeeSessionGuard],
})
export class AuthOtpModule {}