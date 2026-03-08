/* eslint-disable no-console */

type JsonObject = Record<string, unknown>;

type AdminLoginResponse = {
  sessionToken: string;
};

async function main() {
  const baseUrl = normalizeBaseUrl(
    process.env.SMOKE_BASE_URL ??
      process.env.BACKEND_BASE_URL ??
      'http://localhost:3001',
  );

  const adminUsername =
    process.env.SMOKE_ADMIN_USERNAME ?? process.env.ADMIN_USERNAME ?? 'admin';
  const adminPassword =
    process.env.SMOKE_ADMIN_PASSWORD ?? process.env.ADMIN_PASSWORD ?? '';

  if (!adminPassword) {
    throw new Error(
      'Missing admin password. Set SMOKE_ADMIN_PASSWORD or ADMIN_PASSWORD before running smoke checks.',
    );
  }

  logStep(`Smoke checks target: ${baseUrl}`);

  await assertJsonGet(`${baseUrl}/health`, (body) => {
    if (body.ok !== true) {
      throw new Error('GET /health response is not ok=true');
    }
  });

  await assertJsonGet(`${baseUrl}/health/ready`, (body) => {
    if (body.ok !== true) {
      const checks = Array.isArray(body.checks)
        ? JSON.stringify(body.checks)
        : 'n/a';
      throw new Error(`GET /health/ready reports not ready. checks=${checks}`);
    }
  });

  await assertJsonGet(`${baseUrl}/health/db`, (body) => {
    if (body.ok !== true || body.db !== true) {
      throw new Error('GET /health/db response is not { ok: true, db: true }');
    }
  });

  const sessionToken = await adminLogin(baseUrl, adminUsername, adminPassword);

  await assertStatus(
    `${baseUrl}/admin/auth/me`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${sessionToken}`,
      },
    },
    [200],
    'GET /admin/auth/me',
  );

  await assertCsvExport(baseUrl, sessionToken);

  console.log('Smoke checks passed.');
}

async function adminLogin(
  baseUrl: string,
  username: string,
  password: string,
): Promise<string> {
  const response = await fetch(`${baseUrl}/admin/auth/login`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({ username, password }),
  });

  const body = await tryParseJson(response);

  if (!response.ok) {
    throw new Error(
      `POST /admin/auth/login failed with status ${response.status}. body=${JSON.stringify(body)}`,
    );
  }

  const data = body as Partial<AdminLoginResponse>;

  if (!data.sessionToken || typeof data.sessionToken !== 'string') {
    throw new Error('POST /admin/auth/login response has no sessionToken');
  }

  logStep('Admin login check passed');
  return data.sessionToken;
}

async function assertCsvExport(baseUrl: string, sessionToken: string) {
  const response = await fetch(`${baseUrl}/admin/requests/export/csv`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
    },
  });

  const bodyText = await response.text();

  if (!response.ok) {
    throw new Error(
      `GET /admin/requests/export/csv failed with status ${response.status}. body=${bodyText.slice(0, 300)}`,
    );
  }

  const contentType = response.headers.get('content-type') ?? '';

  if (!contentType.toLowerCase().includes('text/csv')) {
    throw new Error(
      `GET /admin/requests/export/csv returned unexpected content-type: ${contentType}`,
    );
  }

  logStep('Admin export CSV check passed');
}

async function assertJsonGet(
  url: string,
  validate: (body: JsonObject) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: 'GET',
  });

  const body = (await tryParseJson(response)) as JsonObject;

  if (!response.ok) {
    throw new Error(
      `GET ${url} failed with status ${response.status}. body=${JSON.stringify(body)}`,
    );
  }

  validate(body);
  logStep(`GET ${url} passed`);
}

async function assertStatus(
  url: string,
  init: RequestInit,
  acceptedStatuses: number[],
  label: string,
): Promise<void> {
  const response = await fetch(url, init);

  if (!acceptedStatuses.includes(response.status)) {
    const body = await response.text();

    throw new Error(
      `${label} failed with status ${response.status}. body=${body.slice(0, 300)}`,
    );
  }

  logStep(`${label} passed`);
}

async function tryParseJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function normalizeBaseUrl(url: string): string {
  return url.trim().replace(/\/$/, '');
}

function logStep(message: string) {
  console.log(`[smoke] ${message}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[smoke] failed: ${message}`);
  process.exitCode = 1;
});
