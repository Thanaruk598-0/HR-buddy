import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { validateProductionConfig } from '../config/runtime-config.guard';
import { PrismaService } from '../prisma/prisma.service';

export type ReadinessCheck = {
  name: string;
  ok: boolean;
  message: string;
  skipped?: boolean;
};

export type ReadinessReport = {
  ok: boolean;
  checkedAt: string;
  checks: ReadinessCheck[];
};

@Injectable()
export class ReadinessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async getReport(): Promise<ReadinessReport> {
    const checks: ReadinessCheck[] = [
      await this.checkDatabase(),
      this.checkOtpProvider(),
      this.checkAttachmentProvider(),
      this.checkProductionRuntimeConfig(),
    ];

    const ok = checks.every((check) => check.ok);

    return {
      ok,
      checkedAt: new Date().toISOString(),
      checks,
    };
  }

  private async checkDatabase(): Promise<ReadinessCheck> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;

      return {
        name: 'database',
        ok: true,
        message: 'database connection is healthy',
      };
    } catch {
      return {
        name: 'database',
        ok: false,
        message: 'database connection failed',
      };
    }
  }

  private checkOtpProvider(): ReadinessCheck {
    const provider =
      this.config.get<string>('otp.deliveryProvider') ?? 'console';
    const strictProviders = this.strictProvidersEnabled();

    if (provider !== 'webhook') {
      if (strictProviders) {
        return {
          name: 'otp-provider',
          ok: false,
          message:
            'READINESS_STRICT_PROVIDERS=true requires OTP_DELIVERY_PROVIDER=webhook',
        };
      }

      return {
        name: 'otp-provider',
        ok: true,
        message: `otp provider '${provider}' is configured`,
      };
    }

    const webhookUrl = this.config.get<string>('otp.webhookUrl')?.trim() ?? '';

    if (!webhookUrl) {
      return {
        name: 'otp-provider',
        ok: false,
        message:
          'otp webhook provider is enabled but OTP_WEBHOOK_URL is missing',
      };
    }

    return {
      name: 'otp-provider',
      ok: true,
      message: 'otp webhook provider is configured',
    };
  }

  private checkAttachmentProvider(): ReadinessCheck {
    const provider =
      this.config.get<string>('attachments.storage.provider') ?? 'local';
    const strictProviders = this.strictProvidersEnabled();

    if (provider !== 'webhook') {
      if (strictProviders) {
        return {
          name: 'attachment-storage-provider',
          ok: false,
          message:
            'READINESS_STRICT_PROVIDERS=true requires ATTACHMENT_STORAGE_PROVIDER=webhook',
        };
      }

      return {
        name: 'attachment-storage-provider',
        ok: true,
        message: `attachment storage provider '${provider}' is configured`,
      };
    }

    const webhookUrl =
      this.config.get<string>('attachments.storage.webhookUrl')?.trim() ?? '';

    if (!webhookUrl) {
      return {
        name: 'attachment-storage-provider',
        ok: false,
        message:
          'attachment webhook provider is enabled but ATTACHMENT_STORAGE_WEBHOOK_URL is missing',
      };
    }

    return {
      name: 'attachment-storage-provider',
      ok: true,
      message: 'attachment storage webhook provider is configured',
    };
  }

  private checkProductionRuntimeConfig(): ReadinessCheck {
    if (process.env.NODE_ENV !== 'production') {
      return {
        name: 'production-runtime-config',
        ok: true,
        skipped: true,
        message: 'skipped outside production environment',
      };
    }

    const errors = validateProductionConfig(this.config).errors;

    if (errors.length === 0) {
      return {
        name: 'production-runtime-config',
        ok: true,
        message: 'production runtime config is valid',
      };
    }

    return {
      name: 'production-runtime-config',
      ok: false,
      message: errors.join('; '),
    };
  }

  private strictProvidersEnabled() {
    return this.config.get<boolean>('readiness.strictProviders') ?? false;
  }
}
