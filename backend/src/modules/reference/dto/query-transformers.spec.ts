import { parseOptionalBooleanQuery } from './query-transformers';

describe('parseOptionalBooleanQuery', () => {
  it('returns undefined for empty values', () => {
    expect(parseOptionalBooleanQuery(undefined)).toBeUndefined();
    expect(parseOptionalBooleanQuery(null)).toBeUndefined();
    expect(parseOptionalBooleanQuery('')).toBeUndefined();
  });

  it('parses valid boolean strings', () => {
    expect(parseOptionalBooleanQuery('true')).toBe(true);
    expect(parseOptionalBooleanQuery('false')).toBe(false);
  });

  it('returns original value for invalid boolean string', () => {
    expect(parseOptionalBooleanQuery('TRUE')).toBe('TRUE');
    expect(parseOptionalBooleanQuery('1')).toBe('1');
  });

  it('keeps boolean values as-is', () => {
    expect(parseOptionalBooleanQuery(true)).toBe(true);
    expect(parseOptionalBooleanQuery(false)).toBe(false);
  });
});
