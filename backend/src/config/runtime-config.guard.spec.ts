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
    'otp.webhookSigningSecret': 'otp-webhook-signing-secret-123456',
    'attachments.storage.provider': 'webhook',
    'attachments.storage.webhookSigningSecret':
      'attachment-webhook-signing-secret-123456',
    'readiness.strictProviders': false,
    corsOrigins: ['https://portal.construction-lines.local'],
    corsAllowCredentials: true,
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

  it('returns validation errors when strict providers mode is enabled but providers are not webhook', () => {
    const result = validateProductionConfig(
      makeConfig({
        'readiness.strictProviders': true,
        'otp.deliveryProvider': 'console',
        'attachments.storage.provider': 'local',
      }),
    );

    expect(result.errors).toContain(
      'READINESS_STRICT_PROVIDERS=true requires OTP_DELIVERY_PROVIDER=webhook',
    );
    expect(result.errors).toContain(
      'READINESS_STRICT_PROVIDERS=true requires ATTACHMENT_STORAGE_PROVIDER=webhook',
    );
  });

  it('does not throw outside production', () => {
    process.env.NODE_ENV = 'development';

    expect(() =>
      assertRuntimeConfig(
        makeConfig({
          otpHashSecret: 'dev-only-change-this-otp-hash-secret',
          'adminAuth.password': 'admin12345',
          'otp.deliveryProvider': 'console',
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

  it('passes in production when config is secure', () => {
    process.env.NODE_ENV = 'production';

    expect(() => assertRuntimeConfig(makeConfig())).not.toThrow();
  });

  it('passes in production strict mode when providers are webhook', () => {
    process.env.NODE_ENV = 'production';

    expect(() =>
      assertRuntimeConfig(
        makeConfig({
          'readiness.strictProviders': true,
          'otp.deliveryProvider': 'webhook',
          'attachments.storage.provider': 'webhook',
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
