import * as path from 'path';
import { resolveGeoDatasetPath } from './geo.dataset-path';

describe('resolveGeoDatasetPath', () => {
  it('returns absolute configured path first when exists', () => {
    const absolutePath = path.resolve(
      'C:/tmp',
      'geo.compiled.json',
    );

    const resolved = resolveGeoDatasetPath({
      cwd: 'C:/workspace/backend',
      moduleDir: 'C:/workspace/backend/src/geo',
      configuredPath: absolutePath,
      exists: (candidate) => candidate === absolutePath,
    });

    expect(resolved).toBe(absolutePath);
  });

  it('resolves relative configured path from cwd', () => {
    const cwd = 'C:/workspace/backend';
    const configuredPath = 'config/geo.compiled.json';
    const expected = path.resolve(cwd, configuredPath);

    const resolved = resolveGeoDatasetPath({
      cwd,
      moduleDir: 'C:/workspace/backend/src/geo',
      configuredPath,
      exists: (candidate) => candidate === expected,
    });

    expect(resolved).toBe(expected);
  });

  it('falls back to source dataset path when configured path is absent', () => {
    const cwd = 'C:/workspace/backend';
    const srcCandidate = path.resolve(
      cwd,
      'src',
      'data',
      'geo',
      'compiled',
      'geo.compiled.json',
    );

    const resolved = resolveGeoDatasetPath({
      cwd,
      moduleDir: 'C:/workspace/backend/src/geo',
      configuredPath: null,
      exists: (candidate) => candidate === srcCandidate,
    });

    expect(resolved).toBe(srcCandidate);
  });

  it('throws with checked paths when file is missing', () => {
    expect(() =>
      resolveGeoDatasetPath({
        cwd: 'C:/workspace/backend',
        moduleDir: 'C:/workspace/backend/src/geo',
        configuredPath: '',
        exists: () => false,
      }),
    ).toThrow('Geo dataset not found.');
  });
});
