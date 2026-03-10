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

  let json = null;
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    try {
      json = await response.json();
    } catch {
      json = null;
    }
  } else {
    await response.text();
  }

  return {
    status: response.status,
    json,
  };
}

function assertExpectedStatus(label, actual, expected) {
  if (expected.includes(actual)) {
    return;
  }

  throw new Error(`${label} returned unexpected status ${actual}. Expected one of: ${expected.join(", ")}`);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function main() {
  log(`Running API contract checks against ${apiBaseUrl}`);

  const checks = [
    {
      label: "GET /health",
      run: () => request("/health"),
      expectedStatus: [200],
      validate: (result) => {
        assert(result.json && typeof result.json === "object", "GET /health must return JSON object");
      },
    },
    {
      label: "GET /reference/departments?isActive=true",
      run: () => request("/reference/departments?isActive=true"),
      expectedStatus: [200],
      validate: (result) => {
        assert(result.json && Array.isArray(result.json.items), "Reference departments response must contain items array");
      },
    },
    {
      label: "GET /geo/provinces",
      run: () => request("/geo/provinces"),
      expectedStatus: [200],
      validate: (result) => {
        assert(Array.isArray(result.json), "Geo provinces response must be an array");
      },
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
    if (check.validate) {
      check.validate(result);
    }
    log(`ok ${check.label} (${result.status})`);
  }

  log("API contract checks passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[api-contract] failed: ${message}\n`);
  process.exit(1);
});
