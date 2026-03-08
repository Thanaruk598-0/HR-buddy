import {
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { ExceptionLoggingFilter } from './common/http/exception-logging.filter';
import { RequestContextMiddleware } from './common/http/request-context.middleware';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import { AppController } from './app.controller';
import { GeoModule } from './geo/geo.module';
import { AdminAuthModule } from './modules/admin-auth/admin-auth.module';
import { AdminRequestsModule } from './modules/admin-requests/admin-requests.module';
import { AdminSettingsModule } from './modules/admin-settings/admin-settings.module';
import { AuthOtpModule } from './modules/auth-otp/auth-otp.module';
import { MaintenanceModule } from './modules/maintenance/maintenance.module';
import { MessengerModule } from './modules/messenger/messenger.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ReferenceModule } from './modules/reference/reference.module';
import { RequestsModule } from './modules/requests/requests.module';
import { PrismaModule } from './prisma/prisma.module';

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
    AdminAuthModule,
    AdminRequestsModule,
    AdminSettingsModule,
    ReferenceModule,
    AuthOtpModule,
    MessengerModule,
    NotificationsModule,
    MaintenanceModule,
  ],
  controllers: [AppController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: RequestLoggingInterceptor,
    },
    {
      provide: APP_FILTER,
      useClass: ExceptionLoggingFilter,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestContextMiddleware).forRoutes('*');
  }
}
