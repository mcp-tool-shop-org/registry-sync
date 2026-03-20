import { describe, it, expect, vi, afterEach } from 'vitest';

describe('getGitHubToken', () => {
  const origGH = process.env.GITHUB_TOKEN;
  const origGH2 = process.env.GH_TOKEN;

  afterEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    if (origGH !== undefined) process.env.GITHUB_TOKEN = origGH;
    else delete process.env.GITHUB_TOKEN;
    if (origGH2 !== undefined) process.env.GH_TOKEN = origGH2;
    else delete process.env.GH_TOKEN;
  });

  it('returns GITHUB_TOKEN from env', async () => {
    process.env.GITHUB_TOKEN = 'test-gh-token';
    delete process.env.GH_TOKEN;
    const { getGitHubToken } = await import('../src/auth.js');
    expect(getGitHubToken()).toBe('test-gh-token');
  });

  it('returns GH_TOKEN when GITHUB_TOKEN is not set', async () => {
    delete process.env.GITHUB_TOKEN;
    process.env.GH_TOKEN = 'gh-fallback';
    const { getGitHubToken } = await import('../src/auth.js');
    expect(getGitHubToken()).toBe('gh-fallback');
  });

  it('prefers GITHUB_TOKEN over GH_TOKEN', async () => {
    process.env.GITHUB_TOKEN = 'primary';
    process.env.GH_TOKEN = 'fallback';
    const { getGitHubToken } = await import('../src/auth.js');
    expect(getGitHubToken()).toBe('primary');
  });

  it('throws AUTH_MISSING when no token available', async () => {
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    vi.doMock('node:child_process', () => ({
      execSync: () => { throw new Error('not found'); },
    }));
    const { getGitHubToken } = await import('../src/auth.js');
    expect(() => getGitHubToken()).toThrow(/No GitHub token found/);
  });

  it('caches token on subsequent calls', async () => {
    process.env.GITHUB_TOKEN = 'cached-token';
    const { getGitHubToken } = await import('../src/auth.js');
    const first = getGitHubToken();
    delete process.env.GITHUB_TOKEN;
    const second = getGitHubToken();
    expect(first).toBe('cached-token');
    expect(second).toBe('cached-token');
  });
});
