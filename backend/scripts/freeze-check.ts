import { existsSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';

type CheckResult = {
  name: string;
  ok: boolean;
  detail?: string;
};

const backendRoot = resolve(__dirname, '..');
const repoRoot = resolve(backendRoot, '..');

function main() {
  const allowDirty = process.argv.includes('--allow-dirty');

  const checks: CheckResult[] = [
    checkRequiredFiles(),
    checkReleaseNoteRc1(),
    checkWorkflowReleaseGate(),
    checkGitMetadata(),
    ...(allowDirty ? [] : [checkGitWorkingTreeClean()]),
  ];

  const failed = checks.filter((item) => !item.ok);

  for (const item of checks) {
    const status = item.ok ? 'PASS' : 'FAIL';
    const suffix = item.detail ? ` (${item.detail})` : '';
    console.log(`[freeze-check] ${status} ${item.name}${suffix}`);
  }

  if (failed.length > 0) {
    console.error(`[freeze-check] failed with ${failed.length} issue(s)`);
    process.exitCode = 1;
    return;
  }

  console.log('[freeze-check] backend freeze checks passed');
}

function checkRequiredFiles(): CheckResult {
  const requiredFiles = [
    join(backendRoot, 'docs', 'deploy-runbook.md'),
    join(backendRoot, 'docs', 'operations-checklist.md'),
    join(backendRoot, 'docs', 'error-contract.md'),
    join(backendRoot, 'docs', 'legal-compliance-th.md'),
    join(backendRoot, 'docs', 'backend-v1-freeze-checklist.md'),
  ];

  const missing = requiredFiles.filter((filePath) => !existsSync(filePath));

  if (missing.length > 0) {
    return {
      name: 'required docs exist',
      ok: false,
      detail: `missing ${missing.map(toRelative).join(', ')}`,
    };
  }

  return { name: 'required docs exist', ok: true };
}

function checkReleaseNoteRc1(): CheckResult {
  const docsDir = join(backendRoot, 'docs');
  const files = readdirSafe(docsDir);

  const found = files.some((name) =>
    /^release-notes-backend-v1-rc1-\d{4}-\d{2}-\d{2}\.md$/.test(name),
  );

  if (!found) {
    return {
      name: 'release notes rc1 file exists',
      ok: false,
      detail: 'expected docs/release-notes-backend-v1-rc1-YYYY-MM-DD.md',
    };
  }

  return { name: 'release notes rc1 file exists', ok: true };
}

function checkWorkflowReleaseGate(): CheckResult {
  const workflowPath = join(
    repoRoot,
    '.github',
    'workflows',
    'backend-release-gate.yml',
  );

  if (!existsSync(workflowPath)) {
    return {
      name: 'backend release gate workflow exists',
      ok: false,
      detail: toRelative(workflowPath),
    };
  }

  return { name: 'backend release gate workflow exists', ok: true };
}

function checkGitMetadata(): CheckResult {
  const branch = runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
  const head = runGit(['rev-parse', '--short', 'HEAD']);

  if (!branch.ok) {
    return {
      name: 'git metadata available',
      ok: false,
      detail: branch.error,
    };
  }

  if (!head.ok) {
    return {
      name: 'git metadata available',
      ok: false,
      detail: head.error,
    };
  }

  return {
    name: 'git metadata available',
    ok: true,
    detail: `branch=${branch.stdout} head=${head.stdout}`,
  };
}

function checkGitWorkingTreeClean(): CheckResult {
  const status = runGit(['status', '--porcelain']);

  if (!status.ok) {
    return {
      name: 'git working tree clean',
      ok: false,
      detail: status.error,
    };
  }

  if (status.stdout.length > 0) {
    return {
      name: 'git working tree clean',
      ok: false,
      detail: 'uncommitted changes present',
    };
  }

  return { name: 'git working tree clean', ok: true };
}

function runGit(args: string[]) {
  const result = spawnSync('git', args, {
    cwd: repoRoot,
    encoding: 'utf8',
    shell: false,
  });

  if (result.error) {
    return {
      ok: false,
      stdout: '',
      error: result.error.message,
    };
  }

  if ((result.status ?? 1) !== 0) {
    return {
      ok: false,
      stdout: '',
      error: (result.stderr || result.stdout || 'git command failed').trim(),
    };
  }

  return {
    ok: true,
    stdout: (result.stdout ?? '').trim(),
    error: '',
  };
}

function readdirSafe(dirPath: string) {
  if (!existsSync(dirPath)) {
    return [] as string[];
  }

  return readdirSync(dirPath, { withFileTypes: true })
    .filter((item) => item.isFile())
    .map((item) => item.name);
}

function toRelative(filePath: string) {
  const normalized = filePath.replace(/\\/g, '/');
  const rootNormalized = repoRoot.replace(/\\/g, '/');

  if (!normalized.startsWith(rootNormalized)) {
    return normalized;
  }

  return normalized.slice(rootNormalized.length + 1);
}

main();
