#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const port = Number(process.env.FRONTEND_SMOKE_PORT ?? 3105);
const host = process.env.FRONTEND_SMOKE_HOST ?? "127.0.0.1";
const fallbackBaseUrl = process.env.FRONTEND_SMOKE_BASE_URL ?? "http://127.0.0.1:3000";

const selfHostDev = process.argv.includes("--self-host");
const selfHostProd = process.argv.includes("--self-host-prod");
const selfHostMode = selfHostProd ? "prod" : selfHostDev ? "dev" : null;

const baseUrl = selfHostMode ? `http://${host}:${port}` : fallbackBaseUrl.replace(/\/$/, "");

const routeTimeoutMs = Number(process.env.SMOKE_ROUTE_TIMEOUT_MS ?? 15000);
const routeRetries = Number(process.env.SMOKE_ROUTE_RETRIES ?? 2);
const routeRetryDelayMs = Number(process.env.SMOKE_ROUTE_RETRY_DELAY_MS ?? 500);
const serverReadyTimeoutMs = Number(process.env.SMOKE_SERVER_READY_TIMEOUT_MS ?? 120000);
const apiTimeoutMs = Number(process.env.SMOKE_API_TIMEOUT_MS ?? 7000);

const routes = [
  "/",
  "/requests/new/building",
  "/requests/new/vehicle",
  "/requests/new/messenger",
  "/requests/new/document",
  "/requests/success/REQ-SMOKE-0001",
  "/auth/otp",
  "/my-requests",
  "/my-requests/sample-id",
  "/messenger/link/sample-token",
  "/admin/login",
  "/admin",
  "/admin/requests",
  "/admin/requests/sample-id",
  "/admin/settings",
  "/admin/audit",
];

const requireApi =
  process.argv.includes("--require-api") ||
  String(process.env.SMOKE_REQUIRE_API ?? "false").toLowerCase() === "true";
const apiBaseUrl = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:3001").replace(/\/$/, "");

function log(message) {
  process.stdout.write(`${message}\n`);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function quoteCmdArgument(value) {
  if (/^[a-zA-Z0-9_./:\\-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function toCmdCommandLine(command, args) {
  return [command, ...args].map((part) => quoteCmdArgument(part)).join(" ");
}

function resolveRuntimeCommand(command, args) {
  if (process.platform !== "win32") {
    return {
      command,
      args,
    };
  }

  return {
    command: "cmd.exe",
    args: ["/d", "/s", "/c", toCmdCommandLine(command, args)],
  };
}

async function fetchWithTimeout(url, timeoutMs) {
  return fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function checkRoute(route) {
  let lastError = null;

  for (let attempt = 1; attempt <= routeRetries + 1; attempt += 1) {
    try {
      const response = await fetchWithTimeout(`${baseUrl}${route}`, routeTimeoutMs);

      if (response.status < 200 || response.status >= 400) {
        throw new Error(`${route} returned ${response.status}`);
      }

      const html = await response.text();
      const contentType = response.headers.get("content-type") ?? "";
      if (!contentType.includes("text/html") && !html.includes("<html")) {
        throw new Error(`${route} did not return an HTML document`);
      }

      log(`[smoke] ok ${route} (${response.status})`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt <= routeRetries) {
        const message = error instanceof Error ? error.message : String(error);
        log(`[smoke] retry ${route} attempt ${attempt}/${routeRetries} (${message})`);
        await wait(routeRetryDelayMs);
      }
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

async function checkApiHealth() {
  try {
    const response = await fetchWithTimeout(`${apiBaseUrl}/health`, apiTimeoutMs);

    if (response.status !== 200) {
      throw new Error(`/health returned ${response.status}`);
    }

    log(`[smoke] ok API health ${apiBaseUrl}/health`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";

    if (requireApi) {
      throw new Error(`API health check failed: ${message}`);
    }

    log(`[smoke] warn API health check skipped/fail: ${message}`);
  }
}

async function runChecks() {
  for (const route of routes) {
    await checkRoute(route);
  }

  await checkApiHealth();
  log(`[smoke] success: checked ${routes.length} frontend routes at ${baseUrl}`);
}

function pushOutputTail(tail, chunk) {
  const lines = chunk
    .toString()
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  for (const line of lines) {
    tail.push(line);
  }

  if (tail.length > 25) {
    tail.splice(0, tail.length - 25);
  }
}

function selfHostArgs(mode) {
  if (mode === "prod") {
    return ["run", "start", "--", "--hostname", host, "--port", String(port)];
  }

  return ["run", "dev", "--", "--hostname", host, "--port", String(port)];
}

async function withSelfHostedServer(mode, work) {
  log(`[smoke] starting frontend ${mode} server at ${baseUrl}`);

  const runtime = resolveRuntimeCommand(npmCommand, selfHostArgs(mode));
  const child = spawn(runtime.command, runtime.args, {
    cwd: process.cwd(),
    stdio: ["ignore", "pipe", "pipe"],
    shell: false,
    env: process.env,
  });

  let exited = false;
  let spawnError = null;
  let lastError = null;
  const outputTail = [];

  child.stdout.on("data", (chunk) => {
    process.stdout.write(`[app] ${chunk.toString()}`);
    pushOutputTail(outputTail, chunk);
  });

  child.stderr.on("data", (chunk) => {
    process.stderr.write(`[app] ${chunk.toString()}`);
    pushOutputTail(outputTail, chunk);
  });

  child.on("error", (error) => {
    spawnError = error;
  });

  child.on("exit", () => {
    exited = true;
  });

  const cleanup = async () => {
    if (exited) {
      return;
    }

    if (process.platform === "win32" && child.pid) {
      spawnSync("taskkill", ["/PID", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      await wait(400);
      return;
    }

    child.kill("SIGTERM");
    await wait(1200);

    if (!exited) {
      child.kill("SIGKILL");
      await wait(300);
    }
  };

  try {
    const start = Date.now();
    let isReady = false;

    while (Date.now() - start < serverReadyTimeoutMs) {
      if (spawnError) {
        throw spawnError;
      }

      if (exited) {
        throw new Error(`frontend ${mode} server exited before ready`);
      }

      try {
        const response = await fetchWithTimeout(`${baseUrl}/`, 4000);
        if (response.status >= 200 && response.status < 500) {
          isReady = true;
          break;
        }
      } catch (error) {
        lastError = error;
      }

      await wait(800);
    }

    if (!isReady) {
      const message = lastError instanceof Error ? lastError.message : "unknown error";
      throw new Error(`Frontend server did not become ready within ${serverReadyTimeoutMs}ms (${message})`);
    }

    await work();
  } catch (error) {
    if (outputTail.length > 0) {
      const tail = outputTail.slice(-8).join(" | ");
      throw new Error(`${error instanceof Error ? error.message : String(error)} | recent output: ${tail}`);
    }

    throw error;
  } finally {
    await cleanup();
  }
}

async function main() {
  if (selfHostMode) {
    await withSelfHostedServer(selfHostMode, runChecks);
    return;
  }

  log(`[smoke] checking existing frontend at ${baseUrl}`);
  await runChecks();
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[smoke] failed: ${message}\n`);

  if (!selfHostMode) {
    process.stderr.write("[smoke] tip: start frontend first, or run `npm run smoke:self-host`\n");
  }

  process.exit(1);
});
