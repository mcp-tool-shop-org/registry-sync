import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { getNpmPackageInfo } from '../../src/providers/npm.js';

describe('getNpmPackageInfo', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns package info for published package', async () => {
    const mockResponse = {
      name: '@mcptoolshop/registry-stats',
      'dist-tags': { latest: '1.2.4' },
      modified: '2026-01-15T00:00:00Z',
    };

    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify(mockResponse), { status: 200 }),
    );

    const result = await getNpmPackageInfo('@mcptoolshop/registry-stats');
    expect(result).not.toBeNull();
    expect(result!.latestVersion).toBe('1.2.4');
    expect(result!.lastPublished).toBe('2026-01-15T00:00:00Z');
  });

  it('returns null for unpublished package (404)', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    const result = await getNpmPackageInfo('@mcptoolshop/nonexistent');
    expect(result).toBeNull();
  });

  it('returns null if no dist-tags.latest', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ name: 'test', 'dist-tags': {} }), {
        status: 200,
      }),
    );

    const result = await getNpmPackageInfo('test');
    expect(result).toBeNull();
  });

  it('returns empty string for lastPublished when modified field is absent', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ name: 'test', 'dist-tags': { latest: '1.0.0' } }), {
        status: 200,
      }),
    );

    const result = await getNpmPackageInfo('test');
    expect(result!.lastPublished).toBe('');
  });

  it('encodes scoped package names correctly', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({
        name: '@scope/pkg',
        'dist-tags': { latest: '1.0.0' },
        modified: '2026-01-01',
      }), { status: 200 }),
    );

    await getNpmPackageInfo('@scope/pkg');
    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('%40scope%2Fpkg');
  });

  it('encodes package names with special characters', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('Not Found', { status: 404 }),
    );

    await getNpmPackageInfo('@my-scope/my.pkg');
    const calledUrl = vi.mocked(globalThis.fetch).mock.calls[0][0] as string;
    expect(calledUrl).toContain('%40my-scope%2Fmy.pkg');
  });
});
