import * as fs from 'fs';
import * as path from 'path';

const GEO_DATASET_RELATIVE_PATH = path.join(
  'data',
  'geo',
  'compiled',
  'geo.compiled.json',
);

export interface ResolveGeoDatasetPathOptions {
  cwd?: string;
  moduleDir?: string;
  configuredPath?: string | null;
  exists?: (filePath: string) => boolean;
}

export function resolveGeoDatasetPath(
  options: ResolveGeoDatasetPathOptions = {},
) {
  const cwd = options.cwd ?? process.cwd();
  const moduleDir = options.moduleDir ?? __dirname;
  const exists = options.exists ?? fs.existsSync;
  const configuredPath = options.configuredPath?.trim();
  const candidates: string[] = [];

  if (configuredPath) {
    candidates.push(
      path.isAbsolute(configuredPath)
        ? configuredPath
        : path.resolve(cwd, configuredPath),
    );
  }

  candidates.push(
    path.resolve(cwd, 'src', GEO_DATASET_RELATIVE_PATH),
    path.resolve(cwd, 'dist', GEO_DATASET_RELATIVE_PATH),
    path.resolve(cwd, GEO_DATASET_RELATIVE_PATH),
    path.resolve(moduleDir, '..', GEO_DATASET_RELATIVE_PATH),
    path.resolve(moduleDir, '..', '..', GEO_DATASET_RELATIVE_PATH),
  );

  const dedupedCandidates = [...new Set(candidates)];
  const resolved = dedupedCandidates.find((filePath) => exists(filePath));

  if (resolved) {
    return resolved;
  }

  throw new Error(
    [
      'Geo dataset not found.',
      'Checked paths:',
      ...dedupedCandidates.map((candidate) => `- ${candidate}`),
      'Set GEO_DATASET_PATH to the dataset file path if needed.',
      'Run: npx ts-node scripts/compile-geo.ts',
    ].join('\n'),
  );
}
