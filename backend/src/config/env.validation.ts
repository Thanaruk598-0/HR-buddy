import * as Joi from 'joi';

export const envValidationSchema = Joi.object({
  PORT: Joi.number().default(3001),
  DATABASE_URL: Joi.string().required(),
  CORS_ORIGINS: Joi.string().default('http://localhost:3000'),
  OTP_HASH_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-otp-hash-secret'),
  OTP_CODE_TTL_MINUTES: Joi.number().integer().min(1).default(5),
  OTP_SESSION_TTL_MINUTES: Joi.number().integer().min(1).default(30),
  OTP_MAX_ATTEMPTS: Joi.number().integer().min(1).max(20).default(5),
  OTP_DELIVERY_PROVIDER: Joi.string().valid('console', 'webhook').default('console'),
  OTP_WEBHOOK_URL: Joi.when('OTP_DELIVERY_PROVIDER', {
    is: 'webhook',
    then: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
    otherwise: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
  }),
  OTP_WEBHOOK_API_KEY: Joi.string().allow('').optional(),
  OTP_WEBHOOK_TIMEOUT_MS: Joi.number().integer().min(500).default(5000),

  ATTACHMENT_UPLOAD_TICKET_SECRET: Joi.string()
    .min(16)
    .default('dev-only-change-this-attachment-upload-ticket-secret'),
  ATTACHMENT_UPLOAD_TICKET_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  ATTACHMENT_DOWNLOAD_URL_TTL_SECONDS: Joi.number().integer().min(60).default(900),
  ATTACHMENT_STORAGE_PROVIDER: Joi.string().valid('local', 'webhook').default('local'),
  ATTACHMENT_STORAGE_BASE_URL: Joi.string()
    .uri({ scheme: ['http', 'https'] })
    .default('http://localhost:3001/storage/mock'),
  ATTACHMENT_STORAGE_WEBHOOK_URL: Joi.when('ATTACHMENT_STORAGE_PROVIDER', {
    is: 'webhook',
    then: Joi.string().uri({ scheme: ['http', 'https'] }).required(),
    otherwise: Joi.string().uri({ scheme: ['http', 'https'] }).optional(),
  }),
  ATTACHMENT_STORAGE_WEBHOOK_API_KEY: Joi.string().allow('').optional(),
  ATTACHMENT_STORAGE_WEBHOOK_TIMEOUT_MS: Joi.number().integer().min(500).default(5000),

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
