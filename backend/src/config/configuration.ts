export default () => ({
  port: parseInt(process.env.PORT ?? '3001', 10),
  corsOrigins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  otpHashSecret:
    process.env.OTP_HASH_SECRET ?? 'dev-only-change-this-otp-hash-secret',
});