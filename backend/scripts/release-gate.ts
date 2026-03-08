/* eslint-disable no-console */

import { spawn } from 'node:child_process';

type GateStep = {
  label: string;
  command: string;
  args: string[];
  requiredEnv?: string[];
};

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm';

async function main() {
  const includeSmoke = process.env.RELEASE_GATE_INCLUDE_SMOKE === 'true';

  log(`Release gate started (includeSmoke=${includeSmoke})`);

  const steps = buildSteps(includeSmoke);

  for (const step of steps) {
    assertRequiredEnv(step);
    await runStep(step);
  }

  log('Release gate passed');
}

function buildSteps(includeSmoke: boolean): GateStep[] {
  const steps: GateStep[] = [
    {
      label: 'Build',
      command: npmCommand,
      args: ['run', 'build'],
    },
    {
      label: 'Unit tests',
      command: npmCommand,
      args: ['run', 'test', '--', '--runInBand'],
    },
    {
      label: 'E2E tests',
      command: npmCommand,
      args: ['run', 'test:e2e', '--', '--runInBand'],
    },
  ];

  if (includeSmoke) {
    steps.push({
      label: 'Preprod smoke checks',
      command: npmCommand,
      args: ['run', 'smoke:preprod'],
      requiredEnv: ['SMOKE_ADMIN_PASSWORD'],
    });
  }

  return steps;
}

function assertRequiredEnv(step: GateStep) {
  if (!step.requiredEnv || step.requiredEnv.length === 0) {
    return;
  }

  const missing = step.requiredEnv.filter((key) => {
    const value = process.env[key];
    return !value || value.trim().length === 0;
  });

  if (missing.length > 0) {
    throw new Error(
      `${step.label} missing env: ${missing.join(', ')}. Set required env values before running release gate.`,
    );
  }
}

async function runStep(step: GateStep) {
  log(`${step.label}...`);
  await exec(step.command, step.args);
  log(`${step.label} passed`);
}

function exec(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const runtime = resolveRuntimeCommand(command, args);

    const child = spawn(runtime.command, runtime.args, {
      stdio: 'inherit',
      shell: false,
      env: process.env,
    });

    child.on('error', (error) => {
      reject(error);
    });

    child.on('exit', (code, signal) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `command failed: ${command} ${args.join(' ')} (exit=${code ?? 'null'}, signal=${signal ?? 'null'})`,
        ),
      );
    });
  });
}

function resolveRuntimeCommand(command: string, args: string[]) {
  if (process.platform !== 'win32') {
    return {
      command,
      args,
    };
  }

  return {
    command: 'cmd.exe',
    args: ['/d', '/s', '/c', toCmdCommandLine(command, args)],
  };
}

function toCmdCommandLine(command: string, args: string[]) {
  return [command, ...args].map((part) => quoteCmdArgument(part)).join(' ');
}

function quoteCmdArgument(value: string) {
  if (/^[a-zA-Z0-9_./:\\-]+$/.test(value)) {
    return value;
  }

  return `"${value.replace(/"/g, '""')}"`;
}

function log(message: string) {
  console.log(`[release-gate] ${message}`);
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[release-gate] failed: ${message}`);
  process.exitCode = 1;
});
