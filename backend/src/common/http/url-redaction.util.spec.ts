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

  it('preserves non-sensitive query string while redacting path token', () => {
    expect(redactUrlForLogs('/messenger/link/abc123?foo=bar')).toBe(
      '/messenger/link/[redacted]?foo=bar',
    );
  });

  it('redacts sensitive query parameters', () => {
    expect(redactUrlForLogs('/auth?token=abc&signature=123&foo=bar')).toBe(
      '/auth?token=[redacted]&signature=[redacted]&foo=bar',
    );
  });

  it('redacts sensitive query parameters case-insensitively and preserves fragments', () => {
    expect(redactUrlForLogs('/auth?Api_Key=abc&otpCode=123#section-1')).toBe(
      '/auth?Api_Key=[redacted]&otpCode=[redacted]#section-1',
    );
  });

  it('redacts sensitive query keys in bracket notation', () => {
    expect(
      redactUrlForLogs(
        '/upload?meta[signature]=abc&payload[token]=123&foo=bar',
      ),
    ).toBe(
      '/upload?meta[signature]=[redacted]&payload[token]=[redacted]&foo=bar',
    );
  });

  it('redacts sensitive query keys in nested camelCase notation', () => {
    expect(
      redactUrlForLogs('/upload?meta[sessionToken]=abc&meta[fileName]=doc.pdf'),
    ).toBe('/upload?meta[sessionToken]=[redacted]&meta[fileName]=doc.pdf');
  });
  it('returns empty string for nullish input', () => {
    expect(redactUrlForLogs(undefined)).toBe('');
    expect(redactUrlForLogs(null)).toBe('');
  });
});
