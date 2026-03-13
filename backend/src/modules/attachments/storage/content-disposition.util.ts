export function buildContentDispositionHeader(params: {
  disposition: 'attachment' | 'inline';
  fileName: string;
}) {
  const sanitizedName = sanitizeFileName(params.fileName);
  const fallbackName = toAsciiFallback(sanitizedName);
  const encodedName = encodeRfc5987Value(sanitizedName);

  return `${params.disposition}; filename="${fallbackName}"; filename*=UTF-8''${encodedName}`;
}

function sanitizeFileName(fileName: string) {
  const sanitized = fileName
    .replace(/[\r\n]/g, '')
    .replace(/[\\/]/g, '_')
    .replace(/"/g, '')
    .trim();

  return sanitized || 'file';
}

function toAsciiFallback(fileName: string) {
  const normalized = fileName.normalize('NFKD').replace(/[\u0300-\u036f]/g, '');
  const ascii = normalized
    .replace(/[^\x20-\x7E]/g, '_')
    .replace(/["\\;]/g, '_')
    .replace(/\s+/g, ' ')
    .trim();

  return ascii || 'file';
}

function encodeRfc5987Value(value: string) {
  return encodeURIComponent(value)
    .replace(/['()]/g, (char) =>
      `%${char.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/\*/g, '%2A');
}
