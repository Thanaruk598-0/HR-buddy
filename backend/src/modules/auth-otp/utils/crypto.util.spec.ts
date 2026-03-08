import {
  generateOtpCode,
  generateSessionToken,
  hashWithSecret,
} from './crypto.util';

describe('auth-otp crypto util', () => {
  it('hashWithSecret should be deterministic', () => {
    expect(hashWithSecret('abc', 'secret')).toBe(
      hashWithSecret('abc', 'secret'),
    );
    expect(hashWithSecret('abc', 'secret')).not.toBe(
      hashWithSecret('abc', 'other-secret'),
    );
  });

  it('generateOtpCode should return numeric string with expected length', () => {
    const otp = generateOtpCode(6);
    expect(otp).toMatch(/^\d{6}$/);
  });

  it('generateSessionToken should return 64-char hex', () => {
    const token = generateSessionToken();
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });
});
