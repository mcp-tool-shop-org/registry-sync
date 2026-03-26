import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

describe('version alignment', () => {
  it('package.json version is semver', () => {
    expect(pkg.version).toMatch(/^\d+\.\d+\.\d+/);
  });

  it('version is >= 1.0.0', () => {
    const major = parseInt(pkg.version.split('.')[0], 10);
    expect(major).toBeGreaterThanOrEqual(1);
  });

  it('CLI --version matches package.json', () => {
    const out = execFileSync(process.execPath, [
      join(__dirname, '..', 'dist', 'cli.js'),
      '--version',
    ], { encoding: 'utf-8' }).trim();
    expect(out).toBe(pkg.version);
  });
});
