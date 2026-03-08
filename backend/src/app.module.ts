import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { ExceptionLoggingFilter } from './common/http/exception-logging.filter';
import { RequestContextMiddleware } from './common/http/request-context.middleware';
import { RequestLoggingInterceptor } from './common/http/request-logging.interceptor';
import { AbuseProtectionService } from './common/security/abuse-protection.service';
import { MemoryRateLimitStore } from './common/security/memory-rate-limit.store';
import { PostgresRateLimitStore } from './common/security/postgres-rate-limit.store';
import { RateLimitGuard } from './common/security/rate-limit.guard';
import configuration from './config/configuration';
import { envValidationSchema } from './config/env.validation';
import { GeoModule } from './geo/geo.module';
import { AdminAuditModule } from './modules/admin-audit/admin-audit.module';
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
    AdminAuditModule,
    AdminSettingsModule,
    ReferenceModule,
    AuthOtpModule,
    MessengerModule,
    NotificationsModule,
    MaintenanceModule,
  ],
  controllers: [AppController],
  providers: [
    AbuseProtectionService,
    MemoryRateLimitStore,
    PostgresRateLimitStore,
    {
      provide: APP_GUARD,
      useClass: RateLimitGuard,
    },
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
