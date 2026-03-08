import { SetMetadata } from '@nestjs/common';
import { RATE_LIMIT_POLICY_KEY, RateLimitPolicyName } from './rate-limit.types';

export const RateLimitPolicy = (policy: RateLimitPolicyName) =>
  SetMetadata(RATE_LIMIT_POLICY_KEY, policy);
