/* eslint-disable no-console */

type JsonObject = Record<string, unknown>;

type AdminLoginResponse = {
  sessionToken: string;
};

type HeaderBag = Record<string, string>;

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
  const healthToken =
    process.env.SMOKE_HEALTH_TOKEN ?? process.env.HEALTH_CHECK_TOKEN ?? '';

  if (!adminPassword) {
    throw new Error(
      'Missing admin password. Set SMOKE_ADMIN_PASSWORD or ADMIN_PASSWORD before running smoke checks.',
    );
  }

  logStep(`Smoke checks target: ${baseUrl}`);

  await assertJsonGet(`${baseUrl}/health`, {}, (body) => {
    if (body.ok !== true) {
      throw new Error('GET /health response is not ok=true');
    }
  });

  const healthHeaders: HeaderBag = {};

  if (healthToken.trim()) {
    healthHeaders['x-health-token'] = healthToken.trim();
  }

  await assertJsonGet(`${baseUrl}/health/ready`, healthHeaders, (body) => {
    if (body.ok !== true) {
      const checks = Array.isArray(body.checks)
        ? JSON.stringify(body.checks)
        : 'n/a';
      throw new Error(`GET /health/ready reports not ready. checks=${checks}`);
    }
  });

  await assertJsonGet(`${baseUrl}/health/db`, healthHeaders, (body) => {
    if (body.ok !== true || body.db !== true) {
      throw new Error('GET /health/db response is not { ok: true, db: true }');
    }
  });

  const sessionToken = await adminLogin(baseUrl, adminUsername, adminPassword);
  const adminHeaders = authHeaders(sessionToken);

  await assertStatus(
    `${baseUrl}/admin/auth/me`,
    {
      method: 'GET',
      headers: adminHeaders,
    },
    [200],
    'GET /admin/auth/me',
  );

  await assertJsonGet(`${baseUrl}/admin/requests/report/summary`, adminHeaders);
  await assertJsonGet(`${baseUrl}/admin/requests`, adminHeaders);
  await assertJsonGet(`${baseUrl}/admin/audit/activity-logs?limit=1`, adminHeaders);
  await assertJsonGet(`${baseUrl}/admin/settings/departments?limit=1`, adminHeaders);
  await assertJsonGet(`${baseUrl}/admin/notifications?limit=1`, adminHeaders);

  await assertJsonGet(`${baseUrl}/reference/departments?isActive=true`, {});
  await assertJsonGet(`${baseUrl}/geo/provinces`, {});

  await assertCsvExport(baseUrl, sessionToken);

  await assertStatus(
    `${baseUrl}/admin/auth/logout`,
    {
      method: 'POST',
      headers: adminHeaders,
    },
    [201],
    'POST /admin/auth/logout',
  );

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
    headers: authHeaders(sessionToken),
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
  headers: HeaderBag,
  validate?: (body: JsonObject) => void,
): Promise<void> {
  const response = await fetch(url, {
    method: 'GET',
    headers,
  });

  const body = (await tryParseJson(response)) as JsonObject;

  if (!response.ok) {
    throw new Error(
      `GET ${url} failed with status ${response.status}. body=${JSON.stringify(body)}`,
    );
  }

  if (validate) {
    validate(body);
  }

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

function authHeaders(sessionToken: string): HeaderBag {
  return {
    Authorization: `Bearer ${sessionToken}`,
  };
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


