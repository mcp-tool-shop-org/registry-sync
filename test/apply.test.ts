import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apply } from '../src/apply.js';
import { fetchGitHub } from '../src/fetch.js';
import type { PlanResult, SyncConfig } from '../src/types.js';

vi.mock('../src/fetch.js');
vi.mock('../src/auth.js', () => ({ getGitHubToken: () => 'test-token-123' }));

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

  // --- scaffold-workflow (createWorkflowPR) path ---

  it('creates workflow PR for scaffold-workflow action', async () => {
    // fetchGitHub mock for getting repo info + ref
    vi.mocked(fetchGitHub)
      .mockResolvedValueOnce({ default_branch: 'main' })
      .mockResolvedValueOnce({ object: { sha: 'abc123' } });
    // Raw fetch for branch creation, file creation, PR creation
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response('', { status: 201 }))
      .mockResolvedValueOnce(new Response('', { status: 201 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ html_url: 'https://github.com/test-org/my-tool/pull/1' }), { status: 201 }),
      );

    const plan = makePlan({
      actions: [
        { type: 'scaffold-workflow', target: 'ghcr', repo: 'my-tool', details: 'No GHCR', risk: 'medium' },
      ],
      summary: { publish: 0, update: 0, scaffold: 1, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].url).toBe('https://github.com/test-org/my-tool/pull/1');
  });

  it('tolerates 422 on branch creation (branch already exists)', async () => {
    vi.mocked(fetchGitHub)
      .mockResolvedValueOnce({ default_branch: 'main' })
      .mockResolvedValueOnce({ object: { sha: 'abc123' } });
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response('', { status: 422 })) // branch exists
      .mockResolvedValueOnce(new Response('', { status: 201 })) // file
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ html_url: 'https://github.com/test-org/tool/pull/2' }), { status: 201 }),
      );

    const plan = makePlan({
      actions: [
        { type: 'scaffold-workflow', target: 'ghcr', repo: 'tool', details: '', risk: 'medium' },
      ],
      summary: { publish: 0, update: 0, scaffold: 1, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(true);
  });

  it('fails when workflow file creation fails', async () => {
    vi.mocked(fetchGitHub)
      .mockResolvedValueOnce({ default_branch: 'main' })
      .mockResolvedValueOnce({ object: { sha: 'abc123' } });
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response('', { status: 201 })) // branch ok
      .mockResolvedValueOnce(new Response('', { status: 500 })); // file fail

    const plan = makePlan({
      actions: [
        { type: 'scaffold-workflow', target: 'ghcr', repo: 'tool', details: '', risk: 'medium' },
      ],
      summary: { publish: 0, update: 0, scaffold: 1, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(false);
    expect(result.results[0].error).toBeDefined();
  });

  it('fails when PR creation fails', async () => {
    vi.mocked(fetchGitHub)
      .mockResolvedValueOnce({ default_branch: 'main' })
      .mockResolvedValueOnce({ object: { sha: 'abc123' } });
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response('', { status: 201 })) // branch
      .mockResolvedValueOnce(new Response('', { status: 201 })) // file
      .mockResolvedValueOnce(new Response('', { status: 500 })); // PR fail

    const plan = makePlan({
      actions: [
        { type: 'scaffold-workflow', target: 'ghcr', repo: 'tool', details: '', risk: 'medium' },
      ],
      summary: { publish: 0, update: 0, scaffold: 1, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(false);
  });

  // --- createIssue edge cases ---

  it('fails with APPLY_FAILED when 422 retry also fails', async () => {
    vi.mocked(globalThis.fetch)
      .mockResolvedValueOnce(new Response('', { status: 422 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }));

    const plan = makePlan({
      actions: [
        { type: 'publish', target: 'npmjs', repo: 'my-tool', details: '', risk: 'medium' },
      ],
      summary: { publish: 1, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(false);
    expect(result.summary.failed).toBe(1);
  });

  it('issue body for publish contains npm pack instructions', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/tool/issues/1' }), { status: 201 }),
    );

    const plan = makePlan({
      actions: [
        { type: 'publish', target: 'npmjs', repo: 'tool', toVersion: '1.0.0', details: '', risk: 'medium' },
      ],
      summary: { publish: 1, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    await apply(plan, config);
    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string);
    expect(body.body).toContain('npm pack');
    expect(body.body).toContain('registry-sync');
  });

  it('issue body for update contains version info', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/tool/issues/1' }), { status: 201 }),
    );

    const plan = makePlan({
      actions: [
        { type: 'update', target: 'npmjs', repo: 'tool', fromVersion: '1.0.0', toVersion: '2.0.0', details: '', risk: 'low' },
      ],
      summary: { publish: 0, update: 1, scaffold: 0, prune: 0, skip: 0 },
    });

    await apply(plan, config);
    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string);
    expect(body.body).toContain('1.0.0');
    expect(body.body).toContain('2.0.0');
  });

  it('issue body for prune contains orphaned language', async () => {
    vi.mocked(globalThis.fetch).mockResolvedValue(
      new Response(JSON.stringify({ html_url: 'https://github.com/test-org/pkg/issues/1' }), { status: 201 }),
    );

    const plan = makePlan({
      actions: [
        { type: 'prune', target: 'ghcr', repo: 'pkg', details: 'Orphaned', risk: 'high' },
      ],
      summary: { publish: 0, update: 0, scaffold: 0, prune: 1, skip: 0 },
    });

    await apply(plan, config);
    const body = JSON.parse(vi.mocked(globalThis.fetch).mock.calls[0][1]!.body as string);
    expect(body.body).toContain('no matching repository');
  });

  // --- executeAction dispatch ---

  it('returns undefined for unknown action types', async () => {
    const plan = makePlan({
      actions: [
        { type: 'unknown-action' as any, target: 'npmjs', repo: 'x', details: '', risk: 'low' },
      ],
      summary: { publish: 0, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.results[0].success).toBe(true);
    expect(result.results[0].url).toBeUndefined();
  });

  // --- Mixed success/failure ---

  it('continues after failure (does not abort remaining actions)', async () => {
    const mockFetch = vi.mocked(globalThis.fetch);
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify({ html_url: 'https://github.com/test-org/a/issues/1' }), { status: 201 }))
      .mockResolvedValueOnce(new Response('', { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ html_url: 'https://github.com/test-org/c/issues/1' }), { status: 201 }));

    const plan = makePlan({
      actions: [
        { type: 'publish', target: 'npmjs', repo: 'a', details: '', risk: 'medium' },
        { type: 'publish', target: 'npmjs', repo: 'b', details: '', risk: 'medium' },
        { type: 'publish', target: 'npmjs', repo: 'c', details: '', risk: 'medium' },
      ],
      summary: { publish: 3, update: 0, scaffold: 0, prune: 0, skip: 0 },
    });

    const result = await apply(plan, config);
    expect(result.summary.succeeded).toBe(2);
    expect(result.summary.failed).toBe(1);
    expect(result.results).toHaveLength(3);
  });
});
