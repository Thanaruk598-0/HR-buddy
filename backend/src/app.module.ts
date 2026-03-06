import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { GeoModule } from './geo/geo.module';
import { AppController } from './app.controller';
import { PrismaModule } from './prisma/prisma.module';
import { RequestsModule } from './modules/requests/requests.module';
import { AdminRequestsModule } from './modules/admin-requests/admin-requests.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { AuthOtpModule } from './modules/auth-otp/auth-otp.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema: envValidationSchema,
    }),
    GeoModule,
    PrismaModule,
    RequestsModule,
    AdminRequestsModule,
    ReferenceModule,
    AuthOtpModule,
  ],
  controllers: [AppController],
})
export class AppModule {}