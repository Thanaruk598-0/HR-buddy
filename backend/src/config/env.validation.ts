import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  GEO_DATASET_PATH: Joi.string().allow('').optional(),
  READINESS_STRICT_PROVIDERS: Joi.boolean().default(false),
  OTP_HASH_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-otp-hash-secret'),
  OTP_CODE_TTL_MINUTES: Joi.number().integer().min(1).default(5),
  OTP_SESSION_TTL_MINUTES: Joi.number().integer().min(1).default(30),
  OTP_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  OTP_SEND_COOLDOWN_SECONDS: Joi.number().integer().min(0).default(60),
  OTP_MAX_SEND_PER_HOUR: Joi.number().integer().min(1).max(60).default(6),
  OTP_DELIVERY_PROVIDER: Joi.string()
    .valid('console', 'webhook')
    .default('console'),
  OTP_WEBHOOK_URL: Joi.when('OTP_DELIVERY_PROVIDER', {
    is: 'webhook',
    then: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .optional(),
  }),
  OTP_WEBHOOK_API_KEY: Joi.string().allow('').optional(),
  OTP_WEBHOOK_SIGNING_SECRET: Joi.string().min(16).allow('').optional(),
  OTP_WEBHOOK_INCLUDE_PHONE: Joi.boolean().default(false),
  OTP_WEBHOOK_TIMEOUT_MS: Joi.number().integer().min(500).default(5000),
  OTP_WEBHOOK_MAX_RETRIES: Joi.number().integer().min(0).max(10).default(2),
  OTP_WEBHOOK_RETRY_DELAY_MS: Joi.number().integer().min(0).default(200),

  REQUEST_DEDUPE_WINDOW_SECONDS: Joi.number().integer().min(0).default(30),
  REQUEST_CREATE_USE_DB_LOCK: Joi.boolean().default(true),

  ABUSE_PROTECTION_ENABLED: Joi.boolean().default(true),
  ABUSE_PROTECTION_STORE: Joi.string()
    .valid('memory', 'postgres')
    .default('memory'),
  ABUSE_PROTECTION_MAX_ENTRIES: Joi.number().integer().min(1000).default(50000),
  ABUSE_PROTECTION_POSTGRES_RETRY_AFTER_SECONDS: Joi.number()
    .integer()
    .min(5)
    .default(30),
  ABUSE_PROTECTION_POSTGRES_CLEANUP_INTERVAL_SECONDS: Joi.number()
    .integer()
    .min(30)
    .default(300),
  ABUSE_PROTECTION_POSTGRES_RETENTION_HOURS: Joi.number()
    .integer()
    .min(1)
    .default(48),
  RATE_LIMIT_OTP_SEND_WINDOW_SECONDS: Joi.number().integer().min(1).default(60),
  RATE_LIMIT_OTP_SEND_MAX_REQUESTS: Joi.number().integer().min(1).default(5),
  RATE_LIMIT_OTP_SEND_BLOCK_SECONDS: Joi.number().integer().min(0).default(300),
  RATE_LIMIT_OTP_VERIFY_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(60),
  RATE_LIMIT_OTP_VERIFY_MAX_REQUESTS: Joi.number().integer().min(1).default(10),
  RATE_LIMIT_OTP_VERIFY_BLOCK_SECONDS: Joi.number()
    .integer()
    .min(0)
    .default(300),
  RATE_LIMIT_ADMIN_LOGIN_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(60),
  RATE_LIMIT_ADMIN_LOGIN_MAX_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .default(10),
  RATE_LIMIT_ADMIN_LOGIN_BLOCK_SECONDS: Joi.number()
    .integer()
    .min(0)
    .default(600),
  RATE_LIMIT_REQUEST_CREATE_WINDOW_SECONDS: Joi.number()
    .integer()
    .min(1)
    .default(60),
  RATE_LIMIT_REQUEST_CREATE_MAX_REQUESTS: Joi.number()
    .integer()
    .min(1)
    .default(30),
  RATE_LIMIT_REQUEST_CREATE_BLOCK_SECONDS: Joi.number()
    .integer()
    .min(0)
    .default(120),

  ATTACHMENT_UPLOAD_TICKET_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-attachment-upload-ticket-secret'),
  ATTACHMENT_UPLOAD_TICKET_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .default(900),
  ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS: Joi.number()
    .integer()
    .min(60)
    .default(900),
  ATTACHMENT_STORAGE_PROVIDER: Joi.string()
    .valid('local', 'webhook')
    .default('local'),
  ATTACHMENT_STORAGE_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001/storage/mock'),
  ATTACHMENT_STORAGE_WEBHOOK_URL: Joi.when('ATTACHMENT_STORAGE_PROVIDER', {
    is: 'webhook',
    then: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .required(),
    otherwise: Joi.string()
      .uri({ scheme: ['http', 'https'] })
      .optional(),
  }),
  ATTACHMENT_STORAGE_WEBHOOK_API_KEY: Joi.string().allow('').optional(),
  ATTACHMENT_STORAGE_WEBHOOK_SIGNING_SECRET: Joi.string()
    .min(16)
    .allow('')
    .optional(),
  ATTACHMENT_STORAGE_WEBHOOK_TIMEOUT_MS: Joi.number()
    .integer()
    .min(500)
    .default(5000),
  ATTACHMENT_STORAGE_WEBHOOK_MAX_RETRIES: Joi.number()
    .integer()
    .min(0)
    .max(10)
    .default(2),
  ATTACHMENT_STORAGE_WEBHOOK_RETRY_DELAY_MS: Joi.number()
    .integer()
    .min(0)
    .default(200),

  RETENTION_ENABLED: Joi.boolean().default(false),
  RETENTION_RUN_ON_STARTUP: Joi.boolean().default(false),
  RETENTION_INTERVAL_HOURS: Joi.number().integer().min(1).default(24),
  RETENTION_USE_DB_LOCK: Joi.boolean().default(true),
  RETENTION_DB_LOCK_KEY: Joi.number().integer().min(1).default(48151623),
  RETENTION_OTP_SESSIONS_DAYS: Joi.number().integer().min(1).default(7),
  RETENTION_EMPLOYEE_SESSIONS_DAYS: Joi.number().integer().min(1).default(7),
  RETENTION_NOTIFICATIONS_DAYS: Joi.number().integer().min(1).default(180),
  RETENTION_ACTIVITY_LOGS_DAYS: Joi.number().integer().min(1).default(365),
  PDPA_ANONYMIZE_MIN_CLOSED_DAYS: Joi.number().integer().min(0).default(30),

  MESSENGER_MAGIC_LINK_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-messenger-magic-link-secret'),
  MESSENGER_MAGIC_LINK_TTL_HOURS: Joi.number().integer().min(1).default(72),
  MESSENGER_MAGIC_LINK_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3000/messenger'),
  ADMIN_USERNAME: Joi.string().min(3).default('admin'),
  ADMIN_PASSWORD: Joi.string().min(8).default('admin12345'),
  ADMIN_SESSION_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-admin-session-secret'),
  ADMIN_SESSION_TTL_MINUTES: Joi.number().integer().min(30).default(480),
});
