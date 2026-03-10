const MESSENGER_LINK_TOKEN_PATTERN = /(\/messenger\/link\/)([^/?#]+)/gi;
const SENSITIVE_QUERY_KEY_PATTERN =
  /(?:token|otp|code|signature|session|password|secret|api[_-]?key)$/i;

export function redactUrlForLogs(url: string | null | undefined) {
  if (!url) {
    return '';
  }

  const withPathRedaction = url.replace(
    MESSENGER_LINK_TOKEN_PATTERN,
    '$1[redacted]',
  );

  return redactSensitiveQuery(withPathRedaction);
}

function redactSensitiveQuery(input: string) {
  const queryIndex = input.indexOf('?');

  if (queryIndex < 0) {
    return input;
  }

  const path = input.slice(0, queryIndex);
  const queryAndHash = input.slice(queryIndex + 1);
  const hashIndex = queryAndHash.indexOf('#');

  const query =
    hashIndex >= 0 ? queryAndHash.slice(0, hashIndex) : queryAndHash;
  const hash = hashIndex >= 0 ? queryAndHash.slice(hashIndex) : '';

  if (!query) {
    return input;
  }

  const redactedPairs = query.split('&').map((pair) => {
    const eqIndex = pair.indexOf('=');

    if (eqIndex < 0) {
      return pair;
    }

    const key = pair.slice(0, eqIndex);

    if (!isSensitiveQueryKey(key)) {
      return pair;
    }

    return `${key}=[redacted]`;
  });

  return `${path}?${redactedPairs.join('&')}${hash}`;
}

function isSensitiveQueryKey(rawKey: string) {
  const key = rawKey.trim();

  if (!key) {
    return false;
  }

  const decoded = decodeQueryKey(key);
  const candidates = [
    ...buildQueryKeyCandidates(key),
    ...buildQueryKeyCandidates(decoded),
  ];

  return candidates.some((candidate) =>
    SENSITIVE_QUERY_KEY_PATTERN.test(candidate),
  );
}

function decodeQueryKey(rawKey: string) {
  try {
    return decodeURIComponent(rawKey.replace(/\+/g, ' '));
  } catch {
    return rawKey;
  }
}

function buildQueryKeyCandidates(rawKey: string) {
  const candidates = new Set<string>();
  const normalized = rawKey.trim();

  if (!normalized) {
    return [];
  }

  candidates.add(normalized);

  const dotted = normalized.replace(/\[([^\]]+)\]/g, '.$1').replace(/\]/g, '');

  candidates.add(dotted);

  for (const segment of dotted.split('.')) {
    const trimmedSegment = segment.trim();

    if (!trimmedSegment) {
      continue;
    }

    candidates.add(trimmedSegment);

    const camelSegments = trimmedSegment.split(/(?=[A-Z])/).filter(Boolean);

    for (const camelSegment of camelSegments) {
      candidates.add(camelSegment);
    }
  }

  return Array.from(candidates);
}
