const MESSENGER_LINK_TOKEN_PATTERN = /(\/messenger\/link\/)([^/?#]+)/gi;

export function redactUrlForLogs(url: string | null | undefined) {
  if (!url) {
    return '';
  }

  const withPathRedaction = url.replace(
    MESSENGER_LINK_TOKEN_PATTERN,
    '$1[redacted]',
  );

  return redactQueryValues(withPathRedaction);
}

function redactQueryValues(input: string) {
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
    return `${key}=[redacted]`;
  });

  return `${path}?${redactedPairs.join('&')}${hash}`;
}
