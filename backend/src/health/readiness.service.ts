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

type RegClassRow = {
  tableExists: string | null;
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
      await this.checkAbuseProtectionStore(),
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

    if (provider === 'webhook') {
      const webhookUrl =
        this.config.get<string>('otp.webhookUrl')?.trim() ?? '';
      const signingSecret =
        this.config.get<string>('otp.webhookSigningSecret')?.trim() ?? '';

      if (!webhookUrl) {
        return {
          name: 'otp-provider',
          ok: false,
          message:
            'otp webhook provider is enabled but OTP_WEBHOOK_URL is missing',
        };
      }

      if (!signingSecret) {
        return {
          name: 'otp-provider',
          ok: false,
          message:
            'otp webhook provider is enabled but OTP_WEBHOOK_SIGNING_SECRET is missing',
        };
      }

      return {
        name: 'otp-provider',
        ok: true,
        message: 'otp webhook provider is configured',
      };
    }

    if (provider === 'smtp') {
      const username =
        this.config.get<string>('otp.smtp.username')?.trim() ?? '';
      const appPassword =
        this.config.get<string>('otp.smtp.appPassword')?.trim() ?? '';
      const fromEmail =
        this.config.get<string>('otp.smtp.fromEmail')?.trim() ?? '';

      if (!username || !appPassword || !fromEmail) {
        return {
          name: 'otp-provider',
          ok: false,
          message:
            'otp smtp provider is enabled but SMTP credentials are incomplete',
        };
      }

      return {
        name: 'otp-provider',
        ok: true,
        message: 'otp smtp provider is configured',
      };
    }

    if (strictProviders) {
      return {
        name: 'otp-provider',
        ok: false,
        message:
          'READINESS_STRICT_PROVIDERS=true requires OTP_DELIVERY_PROVIDER to be smtp or webhook',
      };
    }

    return {
      name: 'otp-provider',
      ok: true,
      message: `otp provider '${provider}' is configured`,
    };
  }

  private checkAttachmentProvider(): ReadinessCheck {
    const provider =
      this.config.get<string>('attachments.storage.provider') ?? 'local';
    const strictProviders = this.strictProvidersEnabled();

    if (provider === 'webhook') {
      const webhookUrl =
        this.config.get<string>('attachments.storage.webhookUrl')?.trim() ?? '';
      const signingSecret =
        this.config
          .get<string>('attachments.storage.webhookSigningSecret')
          ?.trim() ?? '';

      if (!webhookUrl) {
        return {
          name: 'attachment-storage-provider',
          ok: false,
          message:
            'attachment webhook provider is enabled but ATTACHMENT_STORAGE_WEBHOOK_URL is missing',
        };
      }

      if (!signingSecret) {
        return {
          name: 'attachment-storage-provider',
          ok: false,
          message:
            'attachment webhook provider is enabled but ATTACHMENT_STORAGE_WEBHOOK_SIGNING_SECRET is missing',
        };
      }

      return {
        name: 'attachment-storage-provider',
        ok: true,
        message: 'attachment storage webhook provider is configured',
      };
    }

    if (provider === 'b2') {
      const bucketName =
        this.config.get<string>('attachments.storage.b2.bucketName')?.trim() ??
        '';
      const endpoint =
        this.config.get<string>('attachments.storage.b2.s3Endpoint')?.trim() ??
        '';
      const accessKeyId =
        this.config.get<string>('attachments.storage.b2.accessKeyId')?.trim() ??
        '';
      const secretAccessKey =
        this.config
          .get<string>('attachments.storage.b2.secretAccessKey')
          ?.trim() ?? '';

      if (!bucketName || !endpoint || !accessKeyId || !secretAccessKey) {
        return {
          name: 'attachment-storage-provider',
          ok: false,
          message:
            'attachment b2 provider is enabled but B2 credentials are incomplete',
        };
      }

      return {
        name: 'attachment-storage-provider',
        ok: true,
        message: 'attachment storage b2 provider is configured',
      };
    }

    if (strictProviders) {
      return {
        name: 'attachment-storage-provider',
        ok: false,
        message:
          'READINESS_STRICT_PROVIDERS=true requires ATTACHMENT_STORAGE_PROVIDER to be b2 or webhook',
      };
    }

    return {
      name: 'attachment-storage-provider',
      ok: true,
      message: `attachment storage provider '${provider}' is configured`,
    };
  }

  private async checkAbuseProtectionStore(): Promise<ReadinessCheck> {
    const enabled = this.config.get<boolean>('abuseProtection.enabled') ?? true;

    if (!enabled) {
      return {
        name: 'abuse-protection-store',
        ok: true,
        skipped: true,
        message: 'abuse protection is disabled',
      };
    }

    const store = this.config.get<string>('abuseProtection.store') ?? 'memory';

    if (store !== 'postgres') {
      return {
        name: 'abuse-protection-store',
        ok: true,
        message: `abuse protection store '${store}' is configured`,
      };
    }

    try {
      const rows = await this.prisma.$queryRaw<RegClassRow[]>`
        SELECT to_regclass('public.abuse_rate_limit_counters') AS "tableExists"
      `;

      if (!rows[0]?.tableExists) {
        return {
          name: 'abuse-protection-store',
          ok: false,
          message:
            'ABUSE_PROTECTION_STORE=postgres but table abuse_rate_limit_counters is missing',
        };
      }

      return {
        name: 'abuse-protection-store',
        ok: true,
        message: 'abuse protection postgres store is ready',
      };
    } catch {
      return {
        name: 'abuse-protection-store',
        ok: false,
        message: 'failed to verify abuse protection postgres store',
      };
    }
  }

  private checkProductionRuntimeConfig(): ReadinessCheck {
    if (!this.isProduction()) {
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

  private isProduction() {
    return (
      (
        this.config.get<string>('runtimeEnv') ??
        this.config.get<string>('nodeEnv') ??
        ''
      ).toLowerCase() === 'production'
    );
  }
}
