export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  otpHashSecret:
    process.env.OTP_HASH_SECRET ?? 'dev-only-change-this-otp-hash-secret',
  otp: {
    codeTtlMinutes: parseInt(process.env.OTP_CODE_TTL_MINUTES ?? '5', 10),
    sessionTtlMinutes: parseInt(process.env.OTP_SESSION_TTL_MINUTES ?? '30', 10),
    maxAttempts: parseInt(process.env.OTP_MAX_ATTEMPTS ?? '5', 10),
    deliveryProvider: process.env.OTP_DELIVERY_PROVIDER ?? 'console',
    webhookUrl: process.env.OTP_WEBHOOK_URL ?? null,
    webhookApiKey: process.env.OTP_WEBHOOK_API_KEY ?? null,
    webhookTimeoutMs: parseInt(process.env.OTP_WEBHOOK_TIMEOUT_MS ?? '5000', 10),
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
  adminAuth: {
    username: process.env.ADMIN_USERNAME ?? 'admin',
    password: process.env.ADMIN_PASSWORD ?? 'admin12345',
    sessionSecret:
      process.env.ADMIN_SESSION_SECRET ??
      'dev-only-change-this-admin-session-secret',
    sessionTtlMinutes: parseInt(process.env.ADMIN_SESSION_TTL_MINUTES ?? '480', 10),
  },
});
