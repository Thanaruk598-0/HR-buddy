import { createHash, randomBytes } from 'crypto';

export function generateMagicLinkToken(): string {
  return randomBytes(24).toString('hex');
}

export function hashMagicLinkToken(token: string, secret: string): string {
  return createHash('sha256').update(`${secret}:${token}`).digest('hex');
}
