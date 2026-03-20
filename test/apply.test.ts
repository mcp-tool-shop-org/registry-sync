import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apply } from '../src/apply.js';
import type { PlanResult, SyncConfig } from '../src/types.js';

const config: SyncConfig = {
  org: 'test-org',
  exclude: [],
  targets: { npm: { enabled: true }, ghcr: { enabled: true } },
};

function makePlan(overrides?: Partial<PlanResult>): PlanResult {
  return {
    org: 'test-org',
    generatedAt: '2026-01-01T00:00:00Z',
    actions: [],
    summary: { publish: 0, update: 0, scaffold: 0, prune: 0, skip: 0 },
    ...overrides,
  };
}

describe('apply', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
    process.env.GITHUB_TOKEN = 'test-token-123';
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    delete process.env.GITHUB_TOKEN;
  });

  it('skips actions with type "skip"', async () => {
    const plan = makePlan({
      actions: [
        {
          type: 'skip',
          target: 'npmjs',
          repo: 'my-tool',
          details: 'Up to date',
          risk: 'low',
          skipReason: 'current',
        },
      ],
      summary: { publish: 0, update: 0, scaffold: 0, prune: 0, skip: 1 },
    });

    const result = await apply(plan, config);
    expect(result.results).toHaveLength(0);
    expect(result.summary.skipped).toBe(1);
    expect(result.summary.succeeded).toBe(0);
  });

  it('creates issue for publish action', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/my-tool/issues/1' }), {
        status: 201,
      }),
    );

    const plan = makePlan({
      actions: [
        {
          type: 'publish',
          target: 'npmjs',
          repo: 'my-tool',
          toVersion: '1.0.0',
          details: 'Not yet published',
          risk: 'medium',
        },
      ],
      summary: { publish: 1, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results).toHaveLength(1);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].url).toBe('https://github.com/test-org/my-tool/issues/1');
    expect(result.summary.succeeded).toBe(1);

    const call = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(call[0]).toBe('https://api.github.com/repos/test-org/my-tool/issues');
    const body = JSON.parse(call[1]!.body as string);
    expect(body.title).toContain('Publish');
    expect(body.labels).toEqual(['registry-sync']);
  });

  it('creates issue for update action with version info', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/my-tool/issues/2' }), {
        status: 201,
      }),
    );

    const plan = makePlan({
      actions: [
        {
          type: 'update',
          target: 'npmjs',
          repo: 'my-tool',
          fromVersion: '1.0.0',
          toVersion: '1.1.0',
          details: 'Published 1.0.0 < repo 1.1.0',
          risk: 'low',
        },
      ],
      summary: { publish: 0, update: 1, scaffold: 0, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(true);

    const body = JSON.parse((vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string));
    expect(body.title).toContain('1.0.0');
    expect(body.title).toContain('1.1.0');
  });

  it('creates issue for prune action', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/orphan-pkg/issues/1' }), {
        status: 201,
      }),
    );

    const plan = makePlan({
      actions: [
        {
          type: 'prune',
          target: 'ghcr',
          repo: 'orphan-pkg',
          details: 'Orphaned package',
          risk: 'high',
        },
      ],
      summary: { publish: 0, update: 0, scaffold: 0, prune: 1, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(true);
    expect(result.summary.succeeded).toBe(1);
  });

  it('retries without labels on 422', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    // First call returns 422 (label doesn't exist)
    mockFetch.mockResolvedValueOnce(
      new Response('Validation Failed', { status: 422 }),
    );
    // Retry without labels succeeds
    mockFetch.mockResolvedValueOnce(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/my-tool/issues/3' }), {
        status: 201,
      }),
    );

    const plan = makePlan({
      actions: [
        {
          type: 'publish',
          target: 'npmjs',
          repo: 'my-tool',
          toVersion: '1.0.0',
          details: 'Not yet published',
          risk: 'medium',
        },
      ],
      summary: { publish: 1, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2);

    // Second call should NOT have labels
    const retryBody = JSON.parse(mockFetch.mock.calls[1][1]!.body as string);
    expect(retryBody.labels).toBeUndefined();
  });

  it('reports failure when issue creation fails', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response('Server Error', { status: 500 }),
    );

    const plan = makePlan({
      actions: [
        {
          type: 'publish',
          target: 'npmjs',
          repo: 'my-tool',
          toVersion: '1.0.0',
          details: 'Not published',
          risk: 'medium',
        },
      ],
      summary: { publish: 1, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toBeDefined();
    expect(result.summary.failed).toBe(1);
  });

  it('respects --limit option', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/a/issues/1' }), {
        status: 201,
      }),
    );

    const plan = makePlan({
      actions: [
        { type: 'publish', target: 'npmjs', repo: 'tool-a', details: '', risk: 'medium' },
        { type: 'publish', target: 'npmjs', repo: 'tool-b', details: '', risk: 'medium' },
        { type: 'publish', target: 'npmjs', repo: 'tool-c', details: '', risk: 'medium' },
      ],
      summary: { publish: 3, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config, undefined, { limit: 1 });
    expect(result.results).toHaveLength(1);
    expect(result.summary.succeeded).toBe(1);
  });

  it('reports progress during apply', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/a/issues/1' }), {
        status: 201,
      }),
    );

    const plan = makePlan({
      actions: [
        { type: 'publish', target: 'npmjs', repo: 'tool-a', details: '', risk: 'medium' },
        { type: 'publish', target: 'npmjs', repo: 'tool-b', details: '', risk: 'medium' },
      ],
      summary: { publish: 2, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    const progress: { current: number; total: number }[] = [];
    await apply(plan, config, (p) => progress.push({ ...p }));
    expect(progress).toEqual([
      { current: 1, total: 2 },
      { current: 2, total: 2 },
    ]);
  });
});
