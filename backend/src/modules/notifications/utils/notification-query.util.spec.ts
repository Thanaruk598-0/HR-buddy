import { parseOptionalBooleanQuery } from './notification-query.util';

describe('parseOptionalBooleanQuery (notifications)', () => {
  it('returns undefined for empty input', () => {
    expect(parseOptionalBooleanQuery(undefined)).toBeUndefined();
    expect(parseOptionalBooleanQuery(null)).toBeUndefined();
    expect(parseOptionalBooleanQuery('')).toBeUndefined();
  });

  it('parses true/false string', () => {
    expect(parseOptionalBooleanQuery('true')).toBe(true);
    expect(parseOptionalBooleanQuery('false')).toBe(false);
  });

  it('keeps invalid values unchanged', () => {
    expect(parseOptionalBooleanQuery('TRUE')).toBe('TRUE');
    expect(parseOptionalBooleanQuery('1')).toBe('1');
  });
});
