#!/usr/bin/env node

import net from "node:net";
import { spawn } from "node:child_process";
import process from "node:process";

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

const requireApi =
  process.argv.includes("--require-api") ||
  String(process.env.FRONTEND_RELEASE_GATE_REQUIRE_API ?? "false").toLowerCase() === "true";
const skipSmoke =
  process.argv.includes("--skip-smoke") ||
  String(process.env.FRONTEND_RELEASE_GATE_SKIP_SMOKE ?? "false").toLowerCase() === "true";
const requestedSmokePort = Number(process.env.FRONTEND_RELEASE_GATE_SMOKE_PORT ?? (3300 + (process.pid % 1000)));

function log(message) {
  process.stdout.write(`[frontend-release-gate] ${message}\n`);
}

function buildStepEnv(extraEnv) {
  if (!extraEnv) {
    return process.env;
  }

  const merged = {
    ...process.env,
    ...extraEnv,
  };

  // Windows can fail when PATH and Path are both present.
  if (process.platform === "win32" && Object.hasOwn(merged, "PATH") && Object.hasOwn(merged, "Path")) {
    delete merged.PATH;
  }

  return merged;
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

function isPortAvailable(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const server = net.createServer();

    server.once("error", () => {
      resolve(false);
    });

    server.listen(port, host, () => {
      server.close(() => resolve(true));
    });
  });
}

async function resolveSmokePort(startPort) {
  const maxAttempts = 50;

  for (let offset = 0; offset < maxAttempts; offset += 1) {
    const candidate = startPort + offset;
    const available = await isPortAvailable(candidate);

    if (available) {
      return candidate;
    }
  }

  throw new Error(`No available smoke port found from ${startPort} to ${startPort + maxAttempts - 1}`);
}

function runStep(step) {
  return new Promise((resolve, reject) => {
    log(`${step.label}...`);

    const runtime = resolveRuntimeCommand(step.command, step.args);

    const child = spawn(runtime.command, runtime.args, {
      stdio: "inherit",
      shell: false,
      env: buildStepEnv(step.env),
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("exit", (code, signal) => {
      if (code === 0) {
        log(`${step.label} passed`);
        resolve();
        return;
      }

      reject(
        new Error(
          `command failed: ${step.command} ${step.args.join(" ")} (exit=${code ?? "null"}, signal=${signal ?? "null"})`,
        ),
      );
    });
  });
}

async function main() {
  const smokePort = await resolveSmokePort(requestedSmokePort);
  log(`Release gate started (skipSmoke=${skipSmoke}, requireApi=${requireApi}, smokePort=${smokePort})`);

  const steps = [
    {
      label: "Lint",
      command: npmCommand,
      args: ["run", "lint"],
    },
    {
      label: "Typecheck",
      command: npmCommand,
      args: ["run", "typecheck"],
    },
    {
      label: "Tests",
      command: npmCommand,
      args: ["run", "test"],
    },
    {
      label: "Build",
      command: npmCommand,
      args: ["run", "build"],
    },
  ];

  if (!skipSmoke) {
    steps.push({
      label: "Smoke",
      command: npmCommand,
      args: ["run", "smoke:self-host:prod"],
      env: {
        FRONTEND_SMOKE_PORT: String(smokePort),
        ...(requireApi ? { SMOKE_REQUIRE_API: "true" } : {}),
      },
    });
  }

  if (requireApi) {
    steps.push({
      label: "API contract",
      command: npmCommand,
      args: ["run", "api:contract"],
    });
  }

  for (const step of steps) {
    await runStep(step);
  }

  log("Release gate passed");
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`[frontend-release-gate] failed: ${message}\n`);
  process.exit(1);
});
