import { describe, it, expect } from 'vitest';
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
