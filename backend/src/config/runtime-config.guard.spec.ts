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
});
