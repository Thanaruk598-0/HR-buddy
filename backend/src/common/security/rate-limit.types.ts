export const RATE_LIMIT_POLICY_KEY = 'rate_limit_policy';

export type RateLimitPolicyName =
  | 'otpSend'
  | 'otpVerify'
  | 'adminLogin'
  | 'requestCreate';

export type RateLimitPolicyConfig = {
  windowSeconds: number;
  maxRequests: number;
  blockSeconds: number;
};

export type RateLimitConsumeInput = {
  scope: RateLimitPolicyName;
  key: string;
  policy: RateLimitPolicyConfig;
  nowMs?: number;
};

export type RateLimitConsumeResult = {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
  resetAtUnix: number;
};

export type AbuseProtectionStoreName = 'memory' | 'postgres';
