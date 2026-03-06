import { createHash, randomBytes } from 'crypto';

export function hashWithSecret(value: string, secret: string): string {
  return createHash('sha256').update(`${secret}:${value}`).digest('hex');
}

export function generateOtpCode(length = 6): string {
  const digits = '0123456789';
  let result = '';

  for (let i = 0; i < length; i += 1) {
    const byte = randomBytes(1)[0];
    result += digits[byte % digits.length];
  }

  return result;
}

export function generateSessionToken(): string {
  return randomBytes(32).toString('hex');
}