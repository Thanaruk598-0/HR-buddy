import { parseOptionalBooleanQuery } from './query-transformers';

describe('parseOptionalBooleanQuery (admin-settings)', () => {
  it('returns undefined for empty value', () => {
    expect(parseOptionalBooleanQuery(undefined)).toBeUndefined();
    expect(parseOptionalBooleanQuery(null)).toBeUndefined();
    expect(parseOptionalBooleanQuery('')).toBeUndefined();
  });

  it('parses true/false string values', () => {
    expect(parseOptionalBooleanQuery('true')).toBe(true);
    expect(parseOptionalBooleanQuery('false')).toBe(false);
  });

  it('keeps unsupported values unchanged', () => {
    expect(parseOptionalBooleanQuery('TRUE')).toBe('TRUE');
    expect(parseOptionalBooleanQuery('1')).toBe('1');
  });
});
