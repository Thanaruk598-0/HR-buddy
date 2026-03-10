import { redactUrlForLogs } from './url-redaction.util';

describe('redactUrlForLogs', () => {
  it('redacts messenger token in plain link path', () => {
    expect(redactUrlForLogs('/messenger/link/abc123')).toBe(
      '/messenger/link/[redacted]',
    );
  });

  it('redacts messenger token when link has suffix route', () => {
    expect(redactUrlForLogs('/messenger/link/abc123/status')).toBe(
      '/messenger/link/[redacted]/status',
    );
  });

  it('redacts all query values while preserving query keys', () => {
    expect(redactUrlForLogs('/messenger/link/abc123?foo=bar&x=1')).toBe(
      '/messenger/link/[redacted]?foo=[redacted]&x=[redacted]',
    );
  });

  it('redacts sensitive query parameters', () => {
    expect(redactUrlForLogs('/auth?token=abc&signature=123&foo=bar')).toBe(
      '/auth?token=[redacted]&signature=[redacted]&foo=[redacted]',
    );
  });

  it('redacts query values case-insensitively and preserves fragments', () => {
    expect(redactUrlForLogs('/auth?Api_Key=abc&otpCode=123#section-1')).toBe(
      '/auth?Api_Key=[redacted]&otpCode=[redacted]#section-1',
    );
  });

  it('redacts query values in bracket notation', () => {
    expect(
      redactUrlForLogs(
        '/upload?meta[signature]=abc&payload[token]=123&foo=bar',
      ),
    ).toBe(
      '/upload?meta[signature]=[redacted]&payload[token]=[redacted]&foo=[redacted]',
    );
  });

  it('keeps query key without value unchanged', () => {
    expect(redactUrlForLogs('/auth?download&token=abc')).toBe(
      '/auth?download&token=[redacted]',
    );
  });

  it('returns empty string for nullish input', () => {
    expect(redactUrlForLogs(undefined)).toBe('');
    expect(redactUrlForLogs(null)).toBe('');
  });
});
