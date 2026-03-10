import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { ReadinessService } from './readiness.service';

describe('ReadinessService', () => {
  const prisma = {
    $queryRaw: jest.fn(),
  } as unknown as PrismaService;

  const makeConfig = (values: Record<string, unknown>) =>
    ({
      get: jest.fn((key: string) => {
        if (key === 'runtimeEnv') {
          return values[key] ?? 'development';
        }

        return values[key];
      }),
    }) as unknown as ConfigService;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('returns healthy readiness report in non-production when db is reachable', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'database', ok: true }),
        expect.objectContaining({ name: 'otp-provider', ok: true }),
        expect.objectContaining({
          name: 'attachment-storage-provider',
          ok: true,
        }),
        expect.objectContaining({ name: 'abuse-protection-store', ok: true }),
        expect.objectContaining({
          name: 'production-runtime-config',
          ok: true,
          skipped: true,
        }),
      ]),
    );
  });

  it('returns not ready when database check fails', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('db down'));

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'database',
          ok: false,
          message: 'database connection failed',
        }),
      ]),
    );
  });

  it('returns not ready when otp webhook provider is missing URL', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'webhook',
      'otp.webhookUrl': '',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'otp-provider',
          ok: false,
        }),
      ]),
    );
  });

  it('returns not ready when otp webhook provider is missing signing secret', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'webhook',
      'otp.webhookUrl': 'https://otp.example/webhook',
      'otp.webhookSigningSecret': '',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'otp-provider',
          ok: false,
          message:
            'otp webhook provider is enabled but OTP_WEBHOOK_SIGNING_SECRET is missing',
        }),
      ]),
    );
  });

  it('returns not ready when attachment webhook provider is missing signing secret', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'webhook',
      'attachments.storage.webhookUrl': 'https://storage.example/webhook',
      'attachments.storage.webhookSigningSecret': '',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'attachment-storage-provider',
          ok: false,
          message:
            'attachment webhook provider is enabled but ATTACHMENT_STORAGE_WEBHOOK_SIGNING_SECRET is missing',
        }),
      ]),
    );
  });
  it('returns not ready when smtp provider credentials are missing', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'smtp',
      'otp.smtp.username': '',
      'otp.smtp.appPassword': '',
      'otp.smtp.fromEmail': '',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'otp-provider',
          ok: false,
          message:
            'otp smtp provider is enabled but SMTP credentials are incomplete',
        }),
      ]),
    );
  });

  it('returns not ready when strict providers mode requires production-like otp provider', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'webhook',
      'attachments.storage.webhookUrl': 'https://storage.example/webhook',
      'attachments.storage.webhookSigningSecret':
        'attachment-webhook-signing-secret-123456',
      'readiness.strictProviders': true,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'otp-provider',
          ok: false,
          message:
            'READINESS_STRICT_PROVIDERS=true requires OTP_DELIVERY_PROVIDER to be smtp or webhook',
        }),
      ]),
    );
  });

  it('returns not ready when strict providers mode requires production-like attachment provider', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'webhook',
      'otp.webhookUrl': 'https://otp.example/webhook',
      'otp.webhookSigningSecret': 'otp-webhook-signing-secret-123456',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': true,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'attachment-storage-provider',
          ok: false,
          message:
            'READINESS_STRICT_PROVIDERS=true requires ATTACHMENT_STORAGE_PROVIDER to be b2 or webhook',
        }),
      ]),
    );
  });

  it('returns healthy report in strict providers mode when otp is smtp and attachment is b2', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
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
      'readiness.strictProviders': true,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(true);
  });

  it('returns not ready when postgres abuse store table is missing', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ tableExists: null }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'postgres',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'abuse-protection-store',
          ok: false,
          message:
            'ABUSE_PROTECTION_STORE=postgres but table abuse_rate_limit_counters is missing',
        }),
      ]),
    );
  });

  it('returns healthy when postgres abuse store table exists', async () => {
    (prisma.$queryRaw as jest.Mock)
      .mockResolvedValueOnce([{ '?column?': 1 }])
      .mockResolvedValueOnce([{ tableExists: 'abuse_rate_limit_counters' }]);

    const config = makeConfig({
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'postgres',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(true);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'abuse-protection-store',
          ok: true,
          message: 'abuse protection postgres store is ready',
        }),
      ]),
    );
  });

  it('returns not ready in production when runtime config is invalid', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ '?column?': 1 }]);

    const config = makeConfig({
      otpHashSecret: 'dev-only-change-this-otp-hash-secret',
      'attachments.uploadTicketSecret':
        'dev-only-change-this-attachment-upload-ticket-secret',
      messengerMagicLinkSecret:
        'dev-only-change-this-messenger-magic-link-secret',
      'adminAuth.sessionSecret': 'dev-only-change-this-admin-session-secret',
      'adminAuth.password': 'admin12345',
      'otp.deliveryProvider': 'console',
      'attachments.storage.provider': 'local',
      'readiness.strictProviders': false,
      'abuseProtection.enabled': true,
      'abuseProtection.store': 'memory',
      runtimeEnv: 'production',
    });

    const svc = new ReadinessService(prisma, config);

    const report = await svc.getReport();

    expect(report.ok).toBe(false);
    expect(report.checks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: 'production-runtime-config',
          ok: false,
        }),
      ]),
    );
  });
});
