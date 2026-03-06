import { Module } from '@nestjs/common';
import { RequestsController } from './requests.controller';
import { RequestsService } from './requests.service';
import { AuthOtpModule } from '../auth-otp/auth-otp.module';

@Module({
  imports: [AuthOtpModule],
  controllers: [RequestsController],
  providers: [RequestsService],
})
export class RequestsModule {}