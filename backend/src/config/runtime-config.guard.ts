import { ConfigService } from '@nestjs/config';

const DEFAULT_SECRET_MARKER = 'dev-only-change-this';
const DEFAULT_ADMIN_PASSWORD = 'admin12345';

type ValidationResult = {
  errors: string[];
};

export function assertRuntimeConfig(config: ConfigService) {
  if (!shouldValidateRuntimeConfig(config)) {
    return;
  }

  const result = validateProductionConfig(config);

  if (result.errors.length === 0) {
    return;
  }

  const message = [
    'Invalid production runtime configuration:',
    ...result.errors.map((item) => `- ${item}`),
  ].join('\n');

  throw new Error(message);
}

export function validateProductionConfig(
  config: ConfigService,
): ValidationResult {
  const errors: string[] = [];
  const runtimeEnv = getNormalizedEnv(config, 'runtimeEnv');
  const nodeEnv = getNormalizedEnv(config, 'nodeEnv', process.env.NODE_ENV);

  if (runtimeEnv && nodeEnv && runtimeEnv !== nodeEnv) {
    errors.push('RUNTIME_ENV and NODE_ENV must match');
  }

  const productionLikeConfig = isProductionLikeConfiguration(config);

  if (productionLikeConfig) {
    if (runtimeEnv !== 'production') {
      errors.push(
        'RUNTIME_ENV must be production for production-like configuration',
      );
    }

    if (nodeEnv !== 'production') {
      errors.push(
        'NODE_ENV must be production for production-like configuration',
      );
    }
  }

  const secrets: Array<{ key: string; value: string | null | undefined }> = [
    {
      key: 'OTP_HASH_SECRET',
      value: config.get<string>('otpHashSecret'),
    },
    {
      key: 'ATTACHMENT_UPLOAD_TICKET_SECRET',
      value: config.get<string>('attachments.uploadTicketSecret'),
    },
    {
      key: 'MESSENGER_MAGIC_LINK_SECRET',
      value: config.get<string>('messengerMagicLinkSecret'),
    },
    {
      key: 'ADMIN_SESSION_SECRET',
      value: config.get<string>('adminAuth.sessionSecret'),
    },
  ];

  for (const item of secrets) {
    const normalized = (item.value ?? '').trim();

    if (!normalized) {
      errors.push(`${item.key} must be set`);
      continue;
    }

    if (normalized.includes(DEFAULT_SECRET_MARKER)) {
      errors.push(`${item.key} must not use development default value`);
    }
  }

  const adminPassword = (config.get<string>('adminAuth.password') ?? '').trim();

  if (!adminPassword || adminPassword === DEFAULT_ADMIN_PASSWORD) {
    errors.push('ADMIN_PASSWORD must not use default value');
  }

  const healthCheckToken = (
    config.get<string>('health.checkToken') ?? ''
  ).trim();

  if (!healthCheckToken) {
    errors.push('HEALTH_CHECK_TOKEN must be set in production');
  }

  const abuseProtectionStore =
    config.get<string>('abuseProtection.store') ?? 'memory';

  if (abuseProtectionStore !== 'postgres') {
    errors.push('ABUSE_PROTECTION_STORE must be postgres in production');
  }

  if (abuseProtectionStore === 'postgres') {
    const failClosedInProduction =
      config.get<boolean>('abuseProtection.postgres.failClosedInProduction') ??
      true;

    if (!failClosedInProduction) {
      errors.push(
        'ABUSE_PROTECTION_POSTGRES_FAIL_CLOSED_IN_PRODUCTION must be true in production',
      );
    }
  }

  const otpProvider = config.get<string>('otp.deliveryProvider') ?? 'console';

  if (otpProvider === 'console') {
    errors.push('OTP_DELIVERY_PROVIDER cannot be console in production');
  }

  if (otpProvider === 'webhook') {
    const webhookUrl = config.get<string>('otp.webhookUrl')?.trim() ?? '';
    const signingSecret =
      config.get<string>('otp.webhookSigningSecret')?.trim() ?? '';

    if (!webhookUrl) {
      errors.push(
        'OTP_WEBHOOK_URL is required when OTP_DELIVERY_PROVIDER=webhook',
      );
    }

    if (!signingSecret) {
      errors.push(
        'OTP_WEBHOOK_SIGNING_SECRET is required when OTP_DELIVERY_PROVIDER=webhook',
      );
    }
  }

  if (otpProvider === 'smtp') {
    const username = config.get<string>('otp.smtp.username')?.trim() ?? '';
    const appPassword =
      config.get<string>('otp.smtp.appPassword')?.trim() ?? '';
    const fromEmail = config.get<string>('otp.smtp.fromEmail')?.trim() ?? '';

    if (!username) {
      errors.push(
        'OTP_SMTP_USERNAME is required when OTP_DELIVERY_PROVIDER=smtp',
      );
    }

    if (!appPassword) {
      errors.push(
        'OTP_SMTP_APP_PASSWORD is required when OTP_DELIVERY_PROVIDER=smtp',
      );
    }

    if (!fromEmail) {
      errors.push(
        'OTP_SMTP_FROM_EMAIL is required when OTP_DELIVERY_PROVIDER=smtp',
      );
    }
  }

  const attachmentProvider =
    config.get<string>('attachments.storage.provider') ?? 'local';

  if (attachmentProvider === 'local') {
    errors.push('ATTACHMENT_STORAGE_PROVIDER cannot be local in production');
  }

  if (attachmentProvider === 'webhook') {
    const webhookUrl =
      config.get<string>('attachments.storage.webhookUrl')?.trim() ?? '';
    const signingSecret =
      config.get<string>('attachments.storage.webhookSigningSecret')?.trim() ??
      '';

    if (!webhookUrl) {
      errors.push(
        'ATTACHMENT_STORAGE_WEBHOOK_URL is required when ATTACHMENT_STORAGE_PROVIDER=webhook',
      );
    }

    if (!signingSecret) {
      errors.push(
        'ATTACHMENT_STORAGE_WEBHOOK_SIGNING_SECRET is required when ATTACHMENT_STORAGE_PROVIDER=webhook',
      );
    }
  }

  if (attachmentProvider === 'b2') {
    const bucketName =
      config.get<string>('attachments.storage.b2.bucketName')?.trim() ?? '';
    const endpoint =
      config.get<string>('attachments.storage.b2.s3Endpoint')?.trim() ?? '';
    const accessKeyId =
      config.get<string>('attachments.storage.b2.accessKeyId')?.trim() ?? '';
    const secretAccessKey =
      config.get<string>('attachments.storage.b2.secretAccessKey')?.trim() ??
      '';

    if (!bucketName) {
      errors.push(
        'ATTACHMENT_B2_BUCKET_NAME is required when ATTACHMENT_STORAGE_PROVIDER=b2',
      );
    }

    if (!endpoint) {
      errors.push(
        'ATTACHMENT_B2_S3_ENDPOINT is required when ATTACHMENT_STORAGE_PROVIDER=b2',
      );
    }

    if (!accessKeyId) {
      errors.push(
        'ATTACHMENT_B2_ACCESS_KEY_ID is required when ATTACHMENT_STORAGE_PROVIDER=b2',
      );
    }

    if (!secretAccessKey) {
      errors.push(
        'ATTACHMENT_B2_SECRET_ACCESS_KEY is required when ATTACHMENT_STORAGE_PROVIDER=b2',
      );
    }
  }

  const strictProviders =
    config.get<boolean>('readiness.strictProviders') ?? false;

  if (strictProviders) {
    if (otpProvider !== 'webhook' && otpProvider !== 'smtp') {
      errors.push(
        'READINESS_STRICT_PROVIDERS=true requires OTP_DELIVERY_PROVIDER to be smtp or webhook',
      );
    }

    if (attachmentProvider !== 'webhook' && attachmentProvider !== 'b2') {
      errors.push(
        'READINESS_STRICT_PROVIDERS=true requires ATTACHMENT_STORAGE_PROVIDER to be b2 or webhook',
      );
    }
  }

  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];
  const corsAllowCredentials =
    config.get<boolean>('corsAllowCredentials') ?? true;

  if (
    corsAllowCredentials &&
    corsOrigins.some((origin) => origin.trim() === '*')
  ) {
    errors.push(
      'CORS_ORIGINS cannot include * when CORS_ALLOW_CREDENTIALS=true',
    );
  }

  const localOrigins = corsOrigins.filter((origin) =>
    isLocalhostOrigin(origin),
  );

  if (localOrigins.length > 0) {
    errors.push(
      `CORS_ORIGINS must not include localhost origins in production: ${localOrigins.join(', ')}`,
    );
  }

  return { errors };
}

function isLocalhostOrigin(origin: string) {
  const normalized = origin.trim();

  if (!normalized) {
    return false;
  }

  if (normalized === '*') {
    return false;
  }

  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();

    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '::1' ||
      host === '[::1]'
    );
  } catch {
    // keep validation non-breaking for malformed values; Joi handles syntax gate
    return false;
  }
}

function isProductionLikeConfiguration(config: ConfigService) {
  const otpProvider = config.get<string>('otp.deliveryProvider') ?? 'console';
  const attachmentProvider =
    config.get<string>('attachments.storage.provider') ?? 'local';
  const abuseProtectionStore =
    config.get<string>('abuseProtection.store') ?? 'memory';
  const healthCheckToken = (
    config.get<string>('health.checkToken') ?? ''
  ).trim();
  const corsOrigins = config.get<string[]>('corsOrigins') ?? [];

  const hasNonLocalCorsOrigin = corsOrigins.some((origin) => {
    const normalized = origin.trim();

    if (!normalized || normalized === '*') {
      return false;
    }

    return !isLocalhostOrigin(normalized);
  });

  return (
    otpProvider !== 'console' ||
    attachmentProvider !== 'local' ||
    abuseProtectionStore === 'postgres' ||
    Boolean(healthCheckToken) ||
    hasNonLocalCorsOrigin
  );
}

function shouldValidateRuntimeConfig(config: ConfigService) {
  const strict = config.get<boolean>('runtimeConfig.strict') ?? false;

  if (strict) {
    return true;
  }

  if (isProductionLikeConfiguration(config)) {
    return true;
  }

  const runtimeEnv = getNormalizedEnv(config, 'runtimeEnv');
  const nodeEnv = getNormalizedEnv(config, 'nodeEnv', process.env.NODE_ENV);

  if (!runtimeEnv && !nodeEnv) {
    // Fail closed when runtime environment variables are missing to avoid skipping safety checks by mistake.
    return true;
  }

  return runtimeEnv === 'production' || nodeEnv === 'production';
}

function getNormalizedEnv(
  config: ConfigService,
  key: 'runtimeEnv' | 'nodeEnv',
  fallback?: string,
) {
  return (config.get<string>(key) ?? fallback ?? '').trim().toLowerCase();
}
