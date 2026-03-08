import { ConfigService } from '@nestjs/config';

const DEFAULT_SECRET_MARKER = 'dev-only-change-this';
const DEFAULT_ADMIN_PASSWORD = 'admin12345';

type ValidationResult = {
  errors: string[];
};

export function assertRuntimeConfig(config: ConfigService) {
  if (!isProduction()) {
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

  const otpProvider = config.get<string>('otp.deliveryProvider') ?? 'console';

  if (otpProvider === 'console') {
    errors.push('OTP_DELIVERY_PROVIDER cannot be console in production');
  }

  if (otpProvider === 'webhook') {
    const signingSecret =
      config.get<string>('otp.webhookSigningSecret')?.trim() ?? '';

    if (!signingSecret) {
      errors.push(
        'OTP_WEBHOOK_SIGNING_SECRET is required when OTP_DELIVERY_PROVIDER=webhook',
      );
    }
  }

  const attachmentProvider =
    config.get<string>('attachments.storage.provider') ?? 'local';

  if (attachmentProvider === 'webhook') {
    const signingSecret =
      config.get<string>('attachments.storage.webhookSigningSecret')?.trim() ??
      '';

    if (!signingSecret) {
      errors.push(
        'ATTACHMENT_STORAGE_WEBHOOK_SIGNING_SECRET is required when ATTACHMENT_STORAGE_PROVIDER=webhook',
      );
    }
  }

  const strictProviders =
    config.get<boolean>('readiness.strictProviders') ?? false;

  if (strictProviders) {
    if (otpProvider !== 'webhook') {
      errors.push(
        'READINESS_STRICT_PROVIDERS=true requires OTP_DELIVERY_PROVIDER=webhook',
      );
    }

    if (attachmentProvider !== 'webhook') {
      errors.push(
        'READINESS_STRICT_PROVIDERS=true requires ATTACHMENT_STORAGE_PROVIDER=webhook',
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
function isProduction() {
  return process.env.NODE_ENV === 'production';
}
