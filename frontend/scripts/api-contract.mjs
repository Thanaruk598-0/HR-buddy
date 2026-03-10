#!/usr/bin/env node

import process from "node:process";

const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");
const requestTimeoutMs = Number(process.env.API_CONTRACT_TIMEOUT_MS ?? 7000);

function log(message) {
  process.stdout.write(`[api-contract] ${message}\n`);
}

async function request(path, options = {}) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    headers: {
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
    body: options.body,
    signal: AbortSignal.timeout(requestTimeoutMs),
  });

  const text = await response.text();
  return {
    status: response.status,
    text,
  };
}

function assertExpectedStatus(label, actual, expected) {
  if (expected.includes(actual)) {
    return;
  }

  throw new Error(`${label} returned unexpected status ${actual}. Expected one of: ${expected.join(", ")}`);
}

async function main() {
  log(`Running API contract checks against ${apiBaseUrl}`);

  const checks = [
    {
      label: "GET /health",
      run: () => request("/health"),
      expectedStatus: [200],
    },
    {
      label: "GET /admin/auth/me without token",
      run: () => request("/admin/auth/me"),
      expectedStatus: [401, 403],
    },
    {
      label: "GET /requests/my without token",
      run: () => request("/requests/my"),
      expectedStatus: [401, 403],
    },
    {
      label: "POST /auth-otp/send invalid payload",
      run: () =>
        request("/auth-otp/send", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      expectedStatus: [400, 422],
    },
    {
      label: "POST /admin/auth/login invalid payload",
      run: () =>
        request("/admin/auth/login", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({}),
        }),
      expectedStatus: [400, 401, 422, 429],
    },
  ];

  for (const check of checks) {
    const result = await check.run();
    assertExpectedStatus(check.label, result.status, check.expectedStatus);
    log(`ok ${check.label} (${result.status})`);
  }

  log("API contract checks passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[api-contract] failed: ${message}\n`);
  process.exit(1);
});
