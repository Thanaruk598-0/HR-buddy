function decodeRfc5987Value(value: string) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function stripQuotes(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"') && trimmed.length >= 2) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

export function parseFileNameFromContentDisposition(
  contentDisposition: string | null,
) {
  if (!contentDisposition) {
    return null;
  }

  const starMatch = contentDisposition.match(/filename\*\s*=\s*([^;]+)/i);
  if (starMatch?.[1]) {
    const rawStar = stripQuotes(starMatch[1]);
    const parts = rawStar.split("''");
    const encoded = parts.length === 2 ? parts[1] : rawStar;
    const decoded = decodeRfc5987Value(encoded).trim();
    if (decoded) {
      return decoded;
    }
  }

  const fallbackMatch = contentDisposition.match(/filename\s*=\s*([^;]+)/i);
  if (fallbackMatch?.[1]) {
    const fallback = stripQuotes(fallbackMatch[1]).trim();
    if (fallback) {
      return fallback;
    }
  }

  return null;
}

function triggerBrowserDownload(blob: Blob, fileName: string) {
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
}

export async function downloadFileFromPresignedUrl(params: {
  downloadUrl: string;
  fallbackFileName: string;
}) {
  const response = await fetch(params.downloadUrl, {
    method: 'GET',
  });

  if (!response.ok) {
    throw new Error(`Download failed (${response.status})`);
  }

  const headerFileName = parseFileNameFromContentDisposition(
    response.headers.get('content-disposition'),
  );
  const fileName = (headerFileName || params.fallbackFileName || 'download')
    .replace(/[\r\n]/g, '')
    .trim();

  const blob = await response.blob();
  triggerBrowserDownload(blob, fileName || 'download');
}
