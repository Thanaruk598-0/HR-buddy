import {
  generateMagicLinkToken,
  hashMagicLinkToken,
} from './magic-link-token.util';

describe('magic-link-token util', () => {
  it('generates hex token', () => {
    const token = generateMagicLinkToken();
    expect(token).toMatch(/^[a-f0-9]{48}$/);
  });

  it('hashes token deterministically with secret', () => {
    expect(hashMagicLinkToken('abc', 's1')).toBe(
      hashMagicLinkToken('abc', 's1'),
    );
    expect(hashMagicLinkToken('abc', 's1')).not.toBe(
      hashMagicLinkToken('abc', 's2'),
    );
  });
});
