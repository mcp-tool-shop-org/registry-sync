import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { defaultConfig, loadConfig, starterConfig } from '../src/config.js';

describe('defaultConfig', () => {
  it('returns expected defaults', () => {
    const config = defaultConfig();
    expect(config.org).toBe('mcp-tool-shop-org');
    expect(config.exclude).toContain('.github');
    expect(config.exclude).toContain('brand');
    expect(config.targets.npm.enabled).toBe(true);
    expect(config.targets.ghcr.enabled).toBe(true);
  });
});

describe('loadConfig', () => {
  it('returns defaults when no config file exists', () => {
    // Use a directory that definitely has no config file
    const config = loadConfig('/tmp');
    expect(config.org).toBe('mcp-tool-shop-org');
  });
});

describe('starterConfig', () => {
  it('returns valid JSON', () => {
    const starter = starterConfig();
    const parsed = JSON.parse(starter);
    expect(parsed.org).toBe('mcp-tool-shop-org');
    expect(parsed.targets).toBeDefined();
  });

  it('ends with newline', () => {
    expect(starterConfig().endsWith('\n')).toBe(true);
  });
});

describe('loadConfig with config file', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'regsync-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('finds config in parent directory (walks up)', () => {
    writeFileSync(join(tmpDir, 'registry-sync.config.json'), JSON.stringify({ org: 'my-org' }));
    const subDir = join(tmpDir, 'sub');
    mkdirSync(subDir);
    const config = loadConfig(subDir);
    expect(config.org).toBe('my-org');
  });

  it('merges partial config with defaults', () => {
    writeFileSync(join(tmpDir, 'registry-sync.config.json'), JSON.stringify({ org: 'custom-org' }));
    const config = loadConfig(tmpDir);
    expect(config.org).toBe('custom-org');
    expect(config.targets.npm.enabled).toBe(true);
    expect(config.targets.ghcr.enabled).toBe(true);
  });

  it('overrides individual target flags', () => {
    writeFileSync(join(tmpDir, 'registry-sync.config.json'), JSON.stringify({
      targets: { npm: { enabled: false } },
    }));
    const config = loadConfig(tmpDir);
    expect(config.targets.npm.enabled).toBe(false);
    expect(config.targets.ghcr.enabled).toBe(true);
  });

  it('throws CONFIG_INVALID for malformed JSON', () => {
    writeFileSync(join(tmpDir, 'registry-sync.config.json'), '{bad json');
    expect(() => loadConfig(tmpDir)).toThrow(/Failed to parse/);
  });

  it('uses process.cwd() when startDir not provided', () => {
    const config = loadConfig();
    expect(config.org).toBeDefined();
  });
});
