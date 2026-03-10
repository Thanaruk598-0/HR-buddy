export default () => ({
  nodeEnv: (process.env.NODE_ENV ?? '').trim().toLowerCase(),
  runtimeEnv: (process.env.RUNTIME_ENV ?? process.env.NODE_ENV ?? '')
    .trim()
    .toLowerCase(),
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  corsAllowCredentials: process.env.CORS_ALLOW_CREDENTIALS !== 'false',
  geo: {
    datasetPath: process.env.GEO_DATASET_PATH ?? null,
  },
  readiness: {
    strictProviders: process.env.READINESS_STRICT_PROVIDERS === 'true',
  },
  runtimeConfig: {
    strict: process.env.RUNTIME_CONFIG_STRICT === 'true',
  },
  health: {
    checkToken: process.env.HEALTH_CHECK_TOKEN ?? null,
  },
  server: {
    trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  },
  otpHashSecret:
    process.env.OTP_HASH_SECRET ?? 'dev-only-change-this-otp-hash-secret',
  otp: {
    codeTtlMinutes: parseInt(process.env.OTP_CODE_TTL_MINUTES ?? '5', 10),
    sessionTtlMinutes: parseInt(
      process.env.OTP_SESSION_TTL_MINUTES ?? '30',
      10,
    ),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    sendCooldownSeconds: parseInt(
      process.env.OTP_SEND_COOLDOWN_SECONDS ?? '60',
      10,
    ),
    maxSendPerHour: parseInt(process.env.OTP_MAX_SEND_PER_HOUR ?? '6', 10),
    deliveryProvider: process.env.OTP_DELIVERY_PROVIDER ?? 'console',
    webhookUrl: process.env.OTP_WEBHOOK_URL ?? null,
    webhookApiKey: process.env.OTP_WEBHOOK_API_KEY ?? null,
    webhookSigningSecret: process.env.OTP_WEBHOOK_SIGNING_SECRET || null,
    webhookIncludePhone: process.env.OTP_WEBHOOK_INCLUDE_PHONE === 'true',
    webhookTimeoutMs: parseInt(
      process.env.OTP_WEBHOOK_TIMEOUT_MS ?? '5000',
      10,
    ),
    webhookMaxRetries: parseInt(process.env.OTP_WEBHOOK_MAX_RETRIES ?? '2', 10),
    webhookRetryDelayMs: parseInt(
      process.env.OTP_WEBHOOK_RETRY_DELAY_MS ?? '200',
      10,
    ),
    smtp: {
      host: process.env.OTP_SMTP_HOST ?? 'smtp.gmail.com',
      port: parseInt(process.env.OTP_SMTP_PORT ?? '465', 10),
      secure: process.env.OTP_SMTP_SECURE !== 'false',
      username: process.env.OTP_SMTP_USERNAME ?? null,
      appPassword: process.env.OTP_SMTP_APP_PASSWORD ?? null,
      fromEmail: process.env.OTP_SMTP_FROM_EMAIL ?? null,
      timeoutMs: parseInt(process.env.OTP_SMTP_TIMEOUT_MS ?? '8000', 10),
    },
  },
  requestDedupeWindowSeconds: parseInt(
    process.env.REQUEST_DEDUPE_WINDOW_SECONDS ?? '30',
    10,
  ),
  requestCreateUseDbLock: process.env.REQUEST_CREATE_USE_DB_LOCK !== 'false',
  abuseProtection: {
    enabled: process.env.ABUSE_PROTECTION_ENABLED !== 'false',
    store: process.env.ABUSE_PROTECTION_STORE ?? 'memory',
    postgres: {
      retryAfterSeconds: parseInt(
        process.env.ABUSE_PROTECTION_POSTGRES_RETRY_AFTER_SECONDS ?? '30',
        10,
      ),
      cleanupIntervalSeconds: parseInt(
        process.env.ABUSE_PROTECTION_POSTGRES_CLEANUP_INTERVAL_SECONDS ?? '300',
        10,
      ),
      retentionHours: parseInt(
        process.env.ABUSE_PROTECTION_POSTGRES_RETENTION_HOURS ?? '48',
        10,
      ),
      failClosedInProduction:
        (process.env.ABUSE_PROTECTION_POSTGRES_FAIL_CLOSED_IN_PRODUCTION ??
          'true') === 'true',
    },
    maxEntries: parseInt(
      process.env.ABUSE_PROTECTION_MAX_ENTRIES ?? '50000',
      10,
    ),
    policies: {
      otpSend: {
        windowSeconds: parseInt(
          process.env.RATE_LIMIT_OTP_SEND_WINDOW_SECONDS ?? '60',
          10,
        ),
        maxRequests: parseInt(
          process.env.RATE_LIMIT_OTP_SEND_MAX_REQUESTS ?? '5',
          10,
        ),
        blockSeconds: parseInt(
          process.env.RATE_LIMIT_OTP_SEND_BLOCK_SECONDS ?? '300',
          10,
        ),
      },
      otpVerify: {
        windowSeconds: parseInt(
          process.env.RATE_LIMIT_OTP_VERIFY_WINDOW_SECONDS ?? '60',
          10,
        ),
        maxRequests: parseInt(
          process.env.RATE_LIMIT_OTP_VERIFY_MAX_REQUESTS ?? '10',
          10,
        ),
        blockSeconds: parseInt(
          process.env.RATE_LIMIT_OTP_VERIFY_BLOCK_SECONDS ?? '300',
          10,
        ),
      },
      adminLogin: {
        windowSeconds: parseInt(
          process.env.RATE_LIMIT_ADMIN_LOGIN_WINDOW_SECONDS ?? '60',
          10,
        ),
        maxRequests: parseInt(
          process.env.RATE_LIMIT_ADMIN_LOGIN_MAX_REQUESTS ?? '10',
          10,
        ),
        blockSeconds: parseInt(
          process.env.RATE_LIMIT_ADMIN_LOGIN_BLOCK_SECONDS ?? '600',
          10,
        ),
      },
      requestCreate: {
        windowSeconds: parseInt(
          process.env.RATE_LIMIT_REQUEST_CREATE_WINDOW_SECONDS ?? '60',
          10,
        ),
        maxRequests: parseInt(
          process.env.RATE_LIMIT_REQUEST_CREATE_MAX_REQUESTS ?? '30',
          10,
        ),
        blockSeconds: parseInt(
          process.env.RATE_LIMIT_REQUEST_CREATE_BLOCK_SECONDS ?? '120',
          10,
        ),
      },
      messengerLink: {
        windowSeconds: parseInt(
          process.env.RATE_LIMIT_MESSENGER_LINK_WINDOW_SECONDS ?? '60',
          10,
        ),
        maxRequests: parseInt(
          process.env.RATE_LIMIT_MESSENGER_LINK_MAX_REQUESTS ?? '30',
          10,
        ),
        blockSeconds: parseInt(
          process.env.RATE_LIMIT_MESSENGER_LINK_BLOCK_SECONDS ?? '120',
          10,
        ),
      },
    },
  },
  attachments: {
    uploadTicketSecret:
      process.env.ATTACHMENT_UPLOAD_TICKET_SECRET ??
      'dev-only-change-this-attachment-upload-ticket-secret',
    uploadTicketTtlSeconds: parseInt(
      process.env.ATTACHMENT_UPLOAD_TICKET_TTL_SECONDS ?? '900',
      10,
    ),
    downloadUrlTtlSeconds: parseInt(
      process.env.ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS ?? '900',
      10,
    ),
    storage: {
      provider: process.env.ATTACHMENT_STORAGE_PROVIDER ?? 'local',
      baseUrl:
        process.env.ATTACHMENT_STORAGE_BASE_URL ??
        'http://localhost:3001/storage/mock',
      localMock: {
        maxUploadBytes: parseInt(
          process.env.ATTACHMENT_LOCAL_MOCK_MAX_UPLOAD_BYTES ?? '104857600',
          10,
        ),
      },
      webhookUrl: process.env.ATTACHMENT_STORAGE_WEBHOOK_URL ?? null,
      webhookApiKey: process.env.ATTACHMENT_STORAGE_WEBHOOK_API_KEY ?? null,
      webhookSigningSecret:
        process.env.ATTACHMENT_STORAGE_WEBHOOK_SIGNING_SECRET || null,
      webhookTimeoutMs: parseInt(
        process.env.ATTACHMENT_STORAGE_WEBHOOK_TIMEOUT_MS ?? '5000',
        10,
      ),
      webhookMaxRetries: parseInt(
        process.env.ATTACHMENT_STORAGE_WEBHOOK_MAX_RETRIES ?? '2',
        10,
      ),
      webhookRetryDelayMs: parseInt(
        process.env.ATTACHMENT_STORAGE_WEBHOOK_RETRY_DELAY_MS ?? '200',
        10,
      ),
      b2: {
        bucketName: process.env.ATTACHMENT_B2_BUCKET_NAME ?? null,
        s3Endpoint: process.env.ATTACHMENT_B2_S3_ENDPOINT ?? null,
        region: process.env.ATTACHMENT_B2_REGION ?? 'us-west-004',
        accessKeyId: process.env.ATTACHMENT_B2_ACCESS_KEY_ID ?? null,
        secretAccessKey: process.env.ATTACHMENT_B2_SECRET_ACCESS_KEY ?? null,
        maxPresignTtlSeconds: parseInt(
          process.env.ATTACHMENT_B2_MAX_PRESIGN_TTL_SECONDS ?? '3600',
          10,
        ),
      },
    },
  },
  retention: {
    enabled: process.env.RETENTION_ENABLED === 'true',
    runOnStartup: process.env.RETENTION_RUN_ON_STARTUP === 'true',
    intervalHours: parseInt(process.env.RETENTION_INTERVAL_HOURS ?? '24', 10),
    useDbLock: process.env.RETENTION_USE_DB_LOCK !== 'false',
    dbLockKey: parseInt(process.env.RETENTION_DB_LOCK_KEY ?? '48151623', 10),
    otpSessionsDays: parseInt(
      process.env.RETENTION_OTP_SESSIONS_DAYS ?? '7',
      10,
    ),
    employeeSessionsDays: parseInt(
      process.env.RETENTION_EMPLOYEE_SESSIONS_DAYS ?? '7',
      10,
    ),
    notificationsDays: parseInt(
      process.env.RETENTION_NOTIFICATIONS_DAYS ?? '180',
      10,
    ),
    activityLogsDays: parseInt(
      process.env.RETENTION_ACTIVITY_LOGS_DAYS ?? '365',
      10,
    ),
    adminSessionsDays: parseInt(
      process.env.RETENTION_ADMIN_SESSIONS_DAYS ?? '30',
      10,
    ),
  },
  pdpa: {
    anonymizeMinClosedDays: parseInt(
      process.env.PDPA_ANONYMIZE_MIN_CLOSED_DAYS ?? '30',
      10,
    ),
  },
  messengerMagicLinkSecret:
    process.env.MESSENGER_MAGIC_LINK_SECRET ??
    'dev-only-change-this-messenger-magic-link-secret',
  messengerMagicLinkTtlHours: parseInt(
    process.env.MESSENGER_MAGIC_LINK_TTL_HOURS ?? '72',
    10,
  ),
  messengerMagicLinkBaseUrl:
    process.env.MESSENGER_MAGIC_LINK_BASE_URL ??
    'http://localhost:3000/messenger',
  messengerMutationReplayWindowSeconds: parseInt(
    process.env.MESSENGER_MUTATION_REPLAY_WINDOW_SECONDS ?? '5',
    10,
  ),
  adminAuth: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'admin12345',
    sessionSecret:
      process.env.ADMIN_SESSION_SECRET ??
      'dev-only-change-this-admin-session-secret',
    sessionTtlMinutes: parseInt(
      process.env.ADMIN_SESSION_TTL_MINUTES ?? '480',
      10,
    ),
  },
});

function parseTrustProxy(raw: string | undefined) {
  if (!raw) {
    return false;
  }

  const trimmed = raw.trim();

  if (!trimmed) {
    return false;
  }

  const normalized = trimmed.toLowerCase();

  if (normalized === 'true') {
    return true;
  }

  if (normalized === 'false') {
    return false;
  }

  if (/^\d+$/.test(trimmed)) {
    return parseInt(trimmed, 10);
  }

  return trimmed;
}
