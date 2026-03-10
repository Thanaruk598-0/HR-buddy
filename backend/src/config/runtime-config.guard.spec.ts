import { ConfigService } from '@nestjs/config';
import {
  assertRuntimeConfig,
  validateProductionConfig,
} from './runtime-config.guard';

describe('runtime-config guard', () => {
  const baseValues: Record<string, unknown> = {
    otpHashSecret: 'otp-strong-secret-1234567890',
    'attachments.uploadTicketSecret': 'attach-strong-secret-1234567890',
    messengerMagicLinkSecret: 'magic-strong-secret-1234567890',
    'adminAuth.sessionSecret': 'admin-session-strong-secret-1234567890',
    'adminAuth.password': 'ultra-strong-admin-password',
    'otp.deliveryProvider': 'webhook',
    'otp.webhookUrl': 'https://otp.example/webhook',
    'otp.webhookSigningSecret': 'otp-webhook-signing-secret-123456',
    'attachments.storage.provider': 'webhook',
    'attachments.storage.webhookUrl': 'https://storage.example/webhook',
    'attachments.storage.webhookSigningSecret':
      'attachment-webhook-signing-secret-123456',
    'readiness.strictProviders': false,
    corsOrigins: ['https://portal.construction-lines.local'],
    corsAllowCredentials: true,
    'runtimeConfig.strict': false,
    runtimeEnv: 'production',
    nodeEnv: 'production',
    'abuseProtection.store': 'postgres',
    'abuseProtection.postgres.failClosedInProduction': true,
    'health.checkToken': 'health-check-token-1234567890',
    'retention.activityLogsDays': 365,
  };

  const makeConfig = (overrides?: Record<string, unknown>) => {
    const values = { ...baseValues, ...(overrides ?? {}) };

    return {
      get: jest.fn((key: string) => values[key]),
    } as unknown as ConfigService;
  };

  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  it('returns validation errors for insecure production config', () => {
    const result = validateProductionConfig(
      makeConfig({
        otpHashSecret: 'dev-only-change-this-otp-hash-secret',
        'adminAuth.password': 'admin12345',
        'otp.deliveryProvider': 'console',
      }),
    );

    expect(result.errors).toContain(
      'OTP_HASH_SECRET must not use development default value',
    );
    expect(result.errors).toContain(
      'ADMIN_PASSWORD must not use default value',
    );
    expect(result.errors).toContain(
      'OTP_DELIVERY_PROVIDER cannot be console in production',
    );
  });

  it('returns validation error when activity log retention is below legal minimum in production mode', () => {
    const result = validateProductionConfig(
      makeConfig({
        'retention.activityLogsDays': 30,
      }),
    );

    expect(result.errors).toContain(
      'RETENTION_ACTIVITY_LOGS_DAYS must be at least 90 in production',
    );
  });
  it('returns validation error when health check token is missing in production mode', () => {
    const result = validateProductionConfig(
      makeConfig({
        'health.checkToken': '',
      }),
    );

    expect(result.errors).toContain(
      'HEALTH_CHECK_TOKEN must be set in production',
    );
  });
  it('returns validation error when abuse protection store is not postgres in production mode', () => {
    const result = validateProductionConfig(
      makeConfig({
        'abuseProtection.store': 'memory',
      }),
    );

    expect(result.errors).toContain(
      'ABUSE_PROTECTION_STORE must be postgres in production',
    );
  });

  it('returns validation error when abuse protection fail-closed flag is disabled in production mode', () => {
    const result = validateProductionConfig(
      makeConfig({
        'abuseProtection.postgres.failClosedInProduction': false,
      }),
    );

    expect(result.errors).toContain(
      'ABUSE_PROTECTION_POSTGRES_FAIL_CLOSED_IN_PRODUCTION must be true in production',
    );
  });

  it('returns validation errors when strict providers mode is enabled but providers are not production-like', () => {
    const result = validateProductionConfig(
      makeConfig({
        'readiness.strictProviders': true,
        'otp.deliveryProvider': 'console',
        'attachments.storage.provider': 'local',
      }),
    );

    expect(result.errors).toContain(
      'READINESS_STRICT_PROVIDERS=true requires OTP_DELIVERY_PROVIDER to be smtp or webhook',
    );
    expect(result.errors).toContain(
      'READINESS_STRICT_PROVIDERS=true requires ATTACHMENT_STORAGE_PROVIDER to be b2 or webhook',
    );
    expect(result.errors).toContain(
      'ATTACHMENT_STORAGE_PROVIDER cannot be local in production',
    );
  });

  it('returns validation error when smtp provider is missing credentials', () => {
    const result = validateProductionConfig(
      makeConfig({
        'otp.deliveryProvider': 'smtp',
        'otp.smtp.username': '',
        'otp.smtp.appPassword': '',
        'otp.smtp.fromEmail': '',
      }),
    );

    expect(result.errors).toContain(
      'OTP_SMTP_USERNAME is required when OTP_DELIVERY_PROVIDER=smtp',
    );
    expect(result.errors).toContain(
      'OTP_SMTP_APP_PASSWORD is required when OTP_DELIVERY_PROVIDER=smtp',
    );
    expect(result.errors).toContain(
      'OTP_SMTP_FROM_EMAIL is required when OTP_DELIVERY_PROVIDER=smtp',
    );
  });

  it('returns validation error when b2 provider is missing credentials', () => {
    const result = validateProductionConfig(
      makeConfig({
        'attachments.storage.provider': 'b2',
        'attachments.storage.b2.bucketName': '',
        'attachments.storage.b2.s3Endpoint': '',
        'attachments.storage.b2.accessKeyId': '',
        'attachments.storage.b2.secretAccessKey': '',
      }),
    );

    expect(result.errors).toContain(
      'ATTACHMENT_B2_BUCKET_NAME is required when ATTACHMENT_STORAGE_PROVIDER=b2',
    );
    expect(result.errors).toContain(
      'ATTACHMENT_B2_S3_ENDPOINT is required when ATTACHMENT_STORAGE_PROVIDER=b2',
    );
    expect(result.errors).toContain(
      'ATTACHMENT_B2_ACCESS_KEY_ID is required when ATTACHMENT_STORAGE_PROVIDER=b2',
    );
    expect(result.errors).toContain(
      'ATTACHMENT_B2_SECRET_ACCESS_KEY is required when ATTACHMENT_STORAGE_PROVIDER=b2',
    );
  });

  it('returns validation error when attachment provider is local in production mode', () => {
    const result = validateProductionConfig(
      makeConfig({
        'attachments.storage.provider': 'local',
      }),
    );

    expect(result.errors).toContain(
      'ATTACHMENT_STORAGE_PROVIDER cannot be local in production',
    );
  });

  it('does not throw outside production for development-like local config', () => {
    process.env.NODE_ENV = 'development';

    expect(() =>
      assertRuntimeConfig(
        makeConfig({
          runtimeEnv: 'development',
          nodeEnv: 'development',
          otpHashSecret: 'dev-only-change-this-otp-hash-secret',
          'adminAuth.password': 'admin12345',
          'otp.deliveryProvider': 'console',
          'attachments.storage.provider': 'local',
          'abuseProtection.store': 'memory',
          'health.checkToken': '',
          corsOrigins: ['http://localhost:3000'],
        }),
      ),
    ).not.toThrow();
  });

  it('throws when runtime env values are missing and config is insecure (fail-closed)', () => {
    delete process.env.NODE_ENV;

    expect(() =>
      assertRuntimeConfig(
        makeConfig({
          runtimeEnv: '',
          nodeEnv: '',
          'otp.deliveryProvider': 'console',
          'attachments.storage.provider': 'local',
          'abuseProtection.store': 'memory',
          'health.checkToken': '',
          corsOrigins: ['http://localhost:3000'],
        }),
      ),
    ).toThrow('OTP_DELIVERY_PROVIDER cannot be console in production');
  });

  it('does not throw when providers are production-like but runtime env is development', () => {
    process.env.NODE_ENV = 'development';

    expect(() =>
      assertRuntimeConfig(
        makeConfig({
          runtimeEnv: 'development',
          nodeEnv: 'development',
          otpHashSecret: 'dev-only-change-this-otp-hash-secret',
          'adminAuth.password': 'admin12345',
          'otp.deliveryProvider': 'smtp',
          'otp.smtp.username': 'sender@gmail.com',
          'otp.smtp.appPassword': 'app-password-123456',
          'otp.smtp.fromEmail': 'sender@gmail.com',
          'attachments.storage.provider': 'b2',
          'attachments.storage.b2.bucketName': 'hrbuddy-attachments',
          'attachments.storage.b2.s3Endpoint':
            'https://s3.us-west-004.backblazeb2.com',
          'attachments.storage.b2.accessKeyId': 'key-id',
          'attachments.storage.b2.secretAccessKey': 'secret-key-123456',
          'abuseProtection.store': 'memory',
          'health.checkToken': '',
          corsOrigins: ['http://localhost:3000'],
        }),
      ),
    ).not.toThrow();
  });

  it('throws in production when config is insecure', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertRuntimeConfig(
        makeConfig({
          'otp.deliveryProvider': 'webhook',
          'otp.webhookSigningSecret': '',
        }),
      ),
    ).toThrow(
      'OTP_WEBHOOK_SIGNING_SECRET is required when OTP_DELIVERY_PROVIDER=webhook',
    );
  });

  it('throws in non-production when runtime strict is enabled', () => {
    process.env.NODE_ENV = 'development';

    expect(() =>
      assertRuntimeConfig(
        makeConfig({
          'runtimeConfig.strict': true,
          'otp.deliveryProvider': 'console',
        }),
      ),
    ).toThrow('OTP_DELIVERY_PROVIDER cannot be console in production');
  });

  it('passes in production when config is secure', () => {
    process.env.NODE_ENV = 'production';

    expect(() => assertRuntimeConfig(makeConfig())).not.toThrow();
  });

  it('passes in production strict mode when providers are smtp and b2', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertRuntimeConfig(
        makeConfig({
          'readiness.strictProviders': true,
          'otp.deliveryProvider': 'smtp',
          'otp.smtp.username': 'sender@gmail.com',
          'otp.smtp.appPassword': 'app-password-123456',
          'otp.smtp.fromEmail': 'sender@gmail.com',
          'attachments.storage.provider': 'b2',
          'attachments.storage.b2.bucketName': 'hrbuddy-attachments',
          'attachments.storage.b2.s3Endpoint':
            'https://s3.us-west-004.backblazeb2.com',
          'attachments.storage.b2.accessKeyId': 'key-id',
          'attachments.storage.b2.secretAccessKey': 'secret-key-123456',
        }),
      ),
    ).not.toThrow();
  });

  it('returns validation error when production cors origins include localhost', () => {
    const result = validateProductionConfig(
      makeConfig({
        corsOrigins: [
          'https://portal.construction-lines.local',
          'http://localhost:3000',
        ],
      }),
    );

    expect(result.errors).toContain(
      'CORS_ORIGINS must not include localhost origins in production: http://localhost:3000',
    );
  });

  it('returns validation error when production cors origins include ipv6 loopback', () => {
    const result = validateProductionConfig(
      makeConfig({
        corsOrigins: ['http://[::1]:3000'],
      }),
    );

    expect(result.errors).toContain(
      'CORS_ORIGINS must not include localhost origins in production: http://[::1]:3000',
    );
  });

  it('returns validation error when RUNTIME_ENV and NODE_ENV do not match', () => {
    const result = validateProductionConfig(
      makeConfig({
        runtimeEnv: 'production',
        nodeEnv: 'development',
      }),
    );

    expect(result.errors).toContain('RUNTIME_ENV and NODE_ENV must match');
  });
  it('returns validation error when wildcard cors origin is used with credentials', () => {
    const result = validateProductionConfig(
      makeConfig({
        corsOrigins: ['*'],
        corsAllowCredentials: true,
      }),
    );

    expect(result.errors).toContain(
      'CORS_ORIGINS cannot include * when CORS_ALLOW_CREDENTIALS=true',
    );
  });

  it('allows wildcard cors origin when credentials are disabled', () => {
    const result = validateProductionConfig(
      makeConfig({
        corsOrigins: ['*'],
        corsAllowCredentials: false,
      }),
    );

    expect(result.errors).not.toContain(
      'CORS_ORIGINS cannot include * when CORS_ALLOW_CREDENTIALS=true',
    );
  });
});
