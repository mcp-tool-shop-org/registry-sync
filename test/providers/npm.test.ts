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
      time: {
        modified: '2026-01-15T00:00:00Z',
        '1.2.4': '2026-01-15T00:00:00Z',
      },
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
});
