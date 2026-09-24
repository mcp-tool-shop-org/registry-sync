import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { main } from '../src/cli.js';
import { audit } from '../src/audit.js';
import { SyncError } from '../src/errors.js';
import type { AuditResult, AuditRow, ApplyResult, DiffResult, PlanResult, SyncConfig } from '../src/types.js';

// audit() walks a real GitHub org; every command here is fed a fixture instead.
vi.mock('../src/audit.js', () => ({ audit: vi.fn() }));
// loadConfig() searches upward from the working directory; pin what it finds.
vi.mock('../src/config.js', () => ({
  loadConfig: (): SyncConfig => ({
    org: 'test-org',
    exclude: [],
    targets: { npm: { enabled: true }, ghcr: { enabled: true } },
  }),
}));
// apply() runs for real against a stubbed fetch; these are its other ways out.
vi.mock('../src/fetch.js');
vi.mock('../src/auth.js', () => ({ getGitHubToken: () => 'test-token' }));

// ---------------------------------------------------------------------------
// Harness
// ---------------------------------------------------------------------------

/** Thrown by the process.exit stub: a real exit never returns, so the stub must not either. */
class ExitCalled extends Error {
  constructor(readonly code: number) {
    super(`process.exit(${code})`);
  }
}

interface CliRun {
  code: number;
  stdout: string;
  stderr: string;
}

const strip = (s: string) => s.replace(/\u001b\[[0-9;]*[A-Za-z]/g, '').replace(/\r/g, '');

/**
 * Runs main() the way a shell sees it: stdout, stderr and the exit code.
 * Nothing is recorded after the first process.exit, because a real process
 * would be gone by then (main's catch block would otherwise log the stub's own throw).
 */
async function runCli(argv: string[]): Promise<CliRun> {
  let code: number | undefined;
  const out: string[] = [];
  const err: string[] = [];
  const live = () => code === undefined;

  vi.spyOn(console, 'log').mockImplementation((...a: unknown[]) => {
    if (live()) out.push(a.join(' '));
  });
  vi.spyOn(console, 'error').mockImplementation((...a: unknown[]) => {
    if (live()) err.push(`${a.join(' ')}\n`);
  });
  vi.spyOn(process.stderr, 'write').mockImplementation(((chunk: string | Uint8Array) => {
    if (live()) err.push(String(chunk));
    return true;
  }) as typeof process.stderr.write);
  vi.spyOn(process, 'exit').mockImplementation(((c?: string | number | null) => {
    if (code === undefined) code = Number(c ?? 0);
    throw new ExitCalled(Number(c ?? 0));
  }) as typeof process.exit);

  try {
    await main(argv);
  } catch (e) {
    if (!(e instanceof ExitCalled)) throw e;
  }
  return { code: code ?? 0, stdout: strip(out.join('\n')), stderr: strip(err.join('')) };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

function row(name: string, presence: AuditRow['presence']): AuditRow {
  return {
    repo: {
      name,
      fullName: `test-org/${name}`,
      language: 'TypeScript',
      archived: false,
      isPrivate: false,
      pushedAt: '2026-09-01T00:00:00Z',
      topics: [],
      defaultBranch: 'main',
      hasPackageJson: true,
      hasDockerfile: false,
      packageJsonName: `@test/${name}`,
      packageJsonVersion: '1.1.0',
    },
    presence,
  };
}

// plan() turns this into: publish tool-new, update tool-old, skip tool-ok.
function makeAudit(overrides?: Partial<AuditResult>): AuditResult {
  return {
    org: 'test-org',
    generatedAt: '2026-09-24T00:00:00Z',
    repoCount: 3,
    rows: [
      row('tool-new', [{ registry: 'npmjs', published: false, drift: 'missing' }]),
      row('tool-old', [{ registry: 'npmjs', published: true, publishedVersion: '1.0.0', drift: 'behind' }]),
      row('tool-ok', [{ registry: 'npmjs', published: true, publishedVersion: '1.1.0', drift: 'current' }]),
    ],
    orphans: [],
    ...overrides,
  };
}

/** audit() reports one progress tick and returns the fixture for whichever org it was asked about. */
function auditReturns(result: AuditResult = makeAudit()) {
  vi.mocked(audit).mockImplementation(async (config, onProgress) => {
    onProgress?.({ phase: 'Scanning repos', current: 1, total: result.rows.length });
    return { ...result, org: config.org };
  });
}

/** Issue creation answers 201 with a URL per repo, or the status given for that repo. */
function issuesApi(statusByRepo: Record<string, number> = {}) {
  vi.mocked(globalThis.fetch).mockImplementation(async (input) => {
    // https://api.github.com/repos/{org}/{repo}/issues
    const repo = String(input).split('/')[5];
    const status = statusByRepo[repo] ?? 201;
    return status === 201
      ? new Response(JSON.stringify({ html_url: `https://github.com/test-org/${repo}/issues/1` }), { status })
      : new Response('{}', { status });
  });
}

let dir: string;

function writeJson(name: string, data: unknown): string {
  const path = join(dir, name);
  writeFileSync(path, typeof data === 'string' ? data : JSON.stringify(data));
  return path;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'regsync-cli-'));
  vi.mocked(audit).mockReset();
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// help / version / unknown
// ---------------------------------------------------------------------------

describe('main: help, version, unknown commands', () => {
  it('prints usage for help, and when no command is given', async () => {
    for (const argv of [['help'], []]) {
      const run = await runCli(argv);
      expect(run.code).toBe(0);
      expect(run.stdout).toContain('Usage:\n  registry-sync <command> [flags]');
      expect(run.stdout).toContain('apply    Execute the plan (requires --confirm)');
      expect(run.stdout).toContain('2  API error, or apply where no action went through');
      expect(run.stdout).toContain('3  apply where some actions failed and some went through');
    }
  });

  it('prints the version from package.json', async () => {
    const here = dirname(fileURLToPath(import.meta.url));
    const pkg = JSON.parse(readFileSync(join(here, '..', 'package.json'), 'utf-8'));
    const run = await runCli(['version']);
    expect(run.code).toBe(0);
    expect(run.stdout).toBe(pkg.version);
  });

  it('exits 1 on an unknown command and names it', async () => {
    const run = await runCli(['frobnicate']);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('Error [INPUT_UNKNOWN_COMMAND]: Unknown command: frobnicate');
    expect(run.stderr).toContain("Hint: Run 'registry-sync help' for usage");
    expect(run.stdout).toBe('');
  });
});

// ---------------------------------------------------------------------------
// audit
// ---------------------------------------------------------------------------

describe('main: audit', () => {
  it('prints the audit table for the --org given, passing --concurrency through', async () => {
    auditReturns();
    const run = await runCli(['audit', '--org', 'other-org', '--concurrency', '3']);
    expect(run.code).toBe(0);
    expect(vi.mocked(audit)).toHaveBeenCalledTimes(1);
    const [config, , options] = vi.mocked(audit).mock.calls[0];
    expect(config.org).toBe('other-org');
    expect(options).toEqual({ concurrency: 3 });
    expect(run.stdout.split('\n')[0]).toBe('Registry Audit: other-org  (3 repos, 2026-09-24T00:00:00Z)');
  });

  it('reports progress on stderr, with ? while the total is unknown', async () => {
    vi.mocked(audit).mockImplementation(async (config, onProgress) => {
      onProgress?.({ phase: 'Listing repos', current: 0, total: 0 });
      onProgress?.({ phase: 'Checking npm', current: 2, total: 3 });
      return makeAudit();
    });
    const run = await runCli(['audit']);
    expect(run.stderr).toContain('Listing repos... 0/?');
    expect(run.stderr).toContain('Checking npm... 2/3');
  });

  it('prints JSON with --json', async () => {
    auditReturns();
    const run = await runCli(['audit', '--json']);
    const parsed = JSON.parse(run.stdout) as AuditResult;
    expect(parsed.org).toBe('test-org');
    expect(parsed.rows.map((r) => r.repo.name)).toEqual(['tool-new', 'tool-old', 'tool-ok']);
  });

  it('prints markdown with --format markdown', async () => {
    auditReturns();
    const run = await runCli(['audit', '--format', 'markdown']);
    expect(run.stdout.split('\n')[0]).toBe('# Registry Audit: test-org');
  });

  it('writes to --out and names the file on stderr instead of printing', async () => {
    auditReturns();
    const out = join(dir, 'audit.json');
    const run = await runCli(['audit', '--json', '--out', out]);
    expect(run.code).toBe(0);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain(`Wrote audit to ${out}`);
    expect((JSON.parse(readFileSync(out, 'utf-8')) as AuditResult).org).toBe('test-org');
  });
});

// ---------------------------------------------------------------------------
// plan
// ---------------------------------------------------------------------------

describe('main: plan', () => {
  it('plans from a saved audit without running a new one', async () => {
    const from = writeJson('audit.json', makeAudit());
    const run = await runCli(['plan', '--from', from, '--json']);
    expect(run.code).toBe(0);
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
    expect(run.stderr).toContain(`Loaded 3 repos from ${from}`);
    const parsed = JSON.parse(run.stdout) as PlanResult;
    expect(parsed.actions.map((a) => [a.type, a.repo])).toEqual([
      ['publish', 'tool-new'],
      ['update', 'tool-old'],
      ['skip', 'tool-ok'],
    ]);
  });

  it('runs a fresh audit when --from is absent, and prints a table', async () => {
    auditReturns();
    const run = await runCli(['plan']);
    expect(run.code).toBe(0);
    expect(vi.mocked(audit)).toHaveBeenCalledTimes(1);
    expect(run.stderr).toContain('Running audit...');
    expect(run.stderr).toContain('Scanning repos... 1/3');
    expect(run.stdout).toMatch(/^Sync Plan: test-org {2}\(/);
    expect(run.stdout).toContain('tool-new');
  });

  it('keeps only the --target registry', async () => {
    const withImage = makeAudit({
      rows: [
        ...makeAudit().rows,
        row('tool-img', [
          { registry: 'npmjs', published: false, drift: 'missing' },
          { registry: 'ghcr', published: false, drift: 'missing' },
        ]),
      ],
    });
    const from = writeJson('audit.json', withImage);
    const run = await runCli(['plan', '--from', from, '--target', 'ghcr', '--json']);
    const parsed = JSON.parse(run.stdout) as PlanResult;
    expect(parsed.actions.map((a) => [a.type, a.target, a.repo])).toEqual([
      ['scaffold-workflow', 'ghcr', 'tool-img'],
    ]);
  });

  it('prints markdown with --format markdown', async () => {
    const from = writeJson('audit.json', makeAudit());
    const run = await runCli(['plan', '--from', from, '--format', 'markdown']);
    expect(run.stdout.split('\n')[0]).toBe('# Sync Plan: test-org');
  });

  it('writes to --out and names the file on stderr instead of printing', async () => {
    const from = writeJson('audit.json', makeAudit());
    const out = join(dir, 'plan.json');
    const run = await runCli(['plan', '--from', from, '--json', '-o', out]);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain(`Wrote plan to ${out}`);
    expect((JSON.parse(readFileSync(out, 'utf-8')) as PlanResult).summary).toEqual({
      publish: 1,
      update: 1,
      scaffold: 0,
      prune: 0,
      skip: 1,
    });
  });

  it('exits 1 when the --from file does not exist', async () => {
    const run = await runCli(['plan', '--from', join(dir, 'missing.json')]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('Error [INPUT_FILE_NOT_FOUND]: Could not read');
    expect(run.stderr).toContain('Hint: Check the file path and try again');
  });

  it('exits 1 when the --from file is not an audit', async () => {
    const from = writeJson('plan.json', { actions: [] });
    const run = await runCli(['plan', '--from', from]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain(`Error [INPUT_INVALID_FILE]: File ${from} is not a valid audit result`);
  });
});

// ---------------------------------------------------------------------------
// apply
// ---------------------------------------------------------------------------

describe('main: apply', () => {
  it('without --confirm, shows the plan and changes nothing', async () => {
    const from = writeJson('audit.json', makeAudit());
    const run = await runCli(['apply', '--from', from]);
    expect(run.code).toBe(0);
    expect(vi.mocked(globalThis.fetch)).not.toHaveBeenCalled();
    expect(run.stdout).toContain('Dry run — use --confirm to execute actions.');
    expect(run.stdout).toContain('Sync Plan: test-org');
    expect(run.stdout).toContain('Run with --confirm to apply these actions.');
  });

  it('with --confirm, reports every action it took, and the summary counts those results', async () => {
    issuesApi();
    const from = writeJson('audit.json', makeAudit());
    const run = await runCli(['apply', '--from', from, '--confirm']);
    expect(run.code).toBe(0);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);
    expect(run.stderr).toContain('Applying 2 of 2 actions');

    const result = JSON.parse(run.stdout) as ApplyResult;
    expect(result.results.map((r) => [r.action.repo, r.success, r.url, r.error])).toEqual([
      ['tool-new', true, 'https://github.com/test-org/tool-new/issues/1', undefined],
      ['tool-old', true, 'https://github.com/test-org/tool-old/issues/1', undefined],
    ]);
    expect(result.summary).toEqual({ succeeded: 2, failed: 0, skipped: 1 });
    expect(run.stderr).toContain('2 succeeded  0 failed  1 skipped');
  });

  it('with --limit, applies only the first N actions and says how many there were', async () => {
    issuesApi();
    const from = writeJson('audit.json', makeAudit());
    const run = await runCli(['apply', '--from', from, '--confirm', '--limit', '1']);
    expect(run.code).toBe(0);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(1);
    expect(run.stderr).toContain('Applying 1 of 2 actions (--limit 1)');
    const result = JSON.parse(run.stdout) as ApplyResult;
    expect(result.results.map((r) => r.action.repo)).toEqual(['tool-new']);
    expect(result.summary).toEqual({ succeeded: 1, failed: 0, skipped: 1 });
  });

  it('writes the results to --out and keeps the summary on stderr', async () => {
    issuesApi();
    const from = writeJson('audit.json', makeAudit());
    const out = join(dir, 'results.json');
    const run = await runCli(['apply', '--from', from, '--confirm', '--out', out]);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain(`Wrote results to ${out}`);
    expect(run.stderr).toContain('2 succeeded  0 failed  1 skipped');
    expect((JSON.parse(readFileSync(out, 'utf-8')) as ApplyResult).results).toHaveLength(2);
  });

  it('runs a fresh audit when --from is absent', async () => {
    auditReturns();
    issuesApi();
    const run = await runCli(['apply', '--confirm']);
    expect(run.code).toBe(0);
    expect(vi.mocked(audit)).toHaveBeenCalledTimes(1);
    expect(run.stderr).toContain('Running audit...');
    expect(run.stderr).toContain('Applying... 2/2');
  });

  it('keeps going past a failed action, reports which one failed, and exits 3', async () => {
    issuesApi({ 'tool-old': 500 });
    const from = writeJson('audit.json', makeAudit());
    const run = await runCli(['apply', '--from', from, '--confirm']);
    expect(vi.mocked(globalThis.fetch)).toHaveBeenCalledTimes(2);

    const result = JSON.parse(run.stdout) as ApplyResult;
    expect(result.results.map((r) => [r.action.repo, r.success, r.url, r.error])).toEqual([
      ['tool-new', true, 'https://github.com/test-org/tool-new/issues/1', undefined],
      ['tool-old', false, undefined, 'Failed to create issue on test-org/tool-old: 500'],
    ]);
    expect(result.summary).toEqual({ succeeded: 1, failed: 1, skipped: 1 });
    expect(run.stderr).toContain('1 succeeded  1 failed  1 skipped');

    // Part of the remote change happened, and a re-run would repeat it: that is not success.
    expect(run.code).toBe(3);
    expect(run.stderr).toContain('Error [APPLY_PARTIAL]: 1 of 2 actions failed; 1 went through');
    expect(run.stderr).toContain('Hint: apply is not idempotent: a re-run files the issues that went through again');
  });

  it('reports every action as failed and exits 2 when none went through', async () => {
    issuesApi({ 'tool-new': 500, 'tool-old': 500 });
    const from = writeJson('audit.json', makeAudit());
    const run = await runCli(['apply', '--from', from, '--confirm']);

    const result = JSON.parse(run.stdout) as ApplyResult;
    expect(result.results.map((r) => r.success)).toEqual([false, false]);
    expect(result.summary).toEqual({ succeeded: 0, failed: 2, skipped: 1 });
    expect(run.stderr).toContain('0 succeeded  2 failed  1 skipped');

    expect(run.code).toBe(2);
    expect(run.stderr).toContain('Error [APPLY_FAILED]: 2 of 2 actions failed; none went through');
    expect(run.stderr).toContain("Hint: Each action's error is in the results");
  });

  it('writes the --out results before exiting on a failure', async () => {
    issuesApi({ 'tool-old': 500 });
    const from = writeJson('audit.json', makeAudit());
    const out = join(dir, 'results.json');
    const run = await runCli(['apply', '--from', from, '--confirm', '--out', out]);
    expect(run.code).toBe(3);
    expect(run.stderr).toContain(`Wrote results to ${out}`);
    const written = JSON.parse(readFileSync(out, 'utf-8')) as ApplyResult;
    expect(written.results.map((r) => [r.action.repo, r.success])).toEqual([
      ['tool-new', true],
      ['tool-old', false],
    ]);
    expect(written.summary).toEqual({ succeeded: 1, failed: 1, skipped: 1 });
  });
});

// ---------------------------------------------------------------------------
// diff
// ---------------------------------------------------------------------------

describe('main: diff', () => {
  const before = makeAudit({
    generatedAt: '2026-09-01T00:00:00Z',
    rows: [
      row('tool-a', [{ registry: 'npmjs', published: true, publishedVersion: '1.0.0', drift: 'current' }]),
      row('tool-b', [{ registry: 'npmjs', published: true, publishedVersion: '1.0.0', drift: 'behind' }]),
    ],
  });
  const after = makeAudit({
    generatedAt: '2026-09-24T00:00:00Z',
    rows: [
      row('tool-a', [{ registry: 'npmjs', published: true, publishedVersion: '1.0.0', drift: 'behind' }]),
      row('tool-b', [{ registry: 'npmjs', published: true, publishedVersion: '1.1.0', drift: 'current' }]),
    ],
  });

  it('exits 1 and says what it needs when a snapshot is missing', async () => {
    const snapshot = writeJson('after.json', after);
    for (const argv of [['diff', '--from', snapshot], ['diff', '--before', snapshot]]) {
      const run = await runCli(argv);
      expect(run.code).toBe(1);
      expect(run.stderr).toContain('Error: diff requires --before <old.json> --from <new.json>');
      expect(run.stderr).toContain('Hint: Run "registry-sync audit --json -o audit.json" to create snapshots');
    }
  });

  it('prints a table of what changed between the two snapshots', async () => {
    const run = await runCli(['diff', '--before', writeJson('before.json', before), '--from', writeJson('after.json', after)]);
    expect(run.code).toBe(0);
    expect(vi.mocked(audit)).not.toHaveBeenCalled();
    expect(run.stdout.split('\n')[0]).toBe('Diff: test-org  2026-09-01T00:00:00Z → 2026-09-24T00:00:00Z');
    expect(run.stdout).toMatch(/^⚠ new_drift\s+tool-a\s+npmjs\s+current → behind \(published 1\.0\.0\)$/m);
    expect(run.stdout).toMatch(/^✓ resolved\s+tool-b\s+npmjs\s+behind → current \(1\.1\.0\)$/m);
  });

  it('prints JSON with --json', async () => {
    const run = await runCli(['diff', '--before', writeJson('before.json', before), '--from', writeJson('after.json', after), '--json']);
    const parsed = JSON.parse(run.stdout) as DiffResult;
    expect(parsed.summary).toMatchObject({ newDrift: 1, resolved: 1, worsened: 0, unchanged: 0 });
  });

  it('prints markdown with --format markdown', async () => {
    const run = await runCli(['diff', '--before', writeJson('before.json', before), '--from', writeJson('after.json', after), '--format', 'markdown']);
    expect(run.stdout.split('\n')[0]).toBe('# Diff: test-org');
    expect(run.stdout).toContain('| 🔴 new_drift | tool-a | npmjs | current → behind (published 1.0.0) |');
  });

  it('writes to --out and names the file on stderr instead of printing', async () => {
    const out = join(dir, 'diff.json');
    const run = await runCli(['diff', '--before', writeJson('before.json', before), '--from', writeJson('after.json', after), '--json', '--out', out]);
    expect(run.stdout).toBe('');
    expect(run.stderr).toContain(`Wrote diff to ${out}`);
    expect((JSON.parse(readFileSync(out, 'utf-8')) as DiffResult).summary.newDrift).toBe(1);
  });

  it('exits 1 when a snapshot is not an audit', async () => {
    const bad = writeJson('before.json', { entries: [] });
    const run = await runCli(['diff', '--before', bad, '--from', writeJson('after.json', after)]);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('Error [INPUT_INVALID_FILE]');
  });
});

// ---------------------------------------------------------------------------
// Exit codes for errors thrown by a command
// ---------------------------------------------------------------------------

describe('main: exit codes for command errors', () => {
  it('exits 1 on an AUTH_ error and prints its hint', async () => {
    vi.mocked(audit).mockRejectedValue(
      new SyncError('AUTH_MISSING', 'No GitHub token found', "Set GITHUB_TOKEN env var or run 'gh auth login'"),
    );
    const run = await runCli(['audit']);
    expect(run.code).toBe(1);
    expect(run.stderr).toContain('Error [AUTH_MISSING]: No GitHub token found');
    expect(run.stderr).toContain("Hint: Set GITHUB_TOKEN env var or run 'gh auth login'");
  });

  it('exits 2 on an API error', async () => {
    vi.mocked(audit).mockRejectedValue(
      new SyncError('GITHUB_RATE_LIMIT', 'GitHub API rate limit exceeded', 'Wait for the reset window'),
    );
    const run = await runCli(['audit']);
    expect(run.code).toBe(2);
    expect(run.stderr).toContain('Error [GITHUB_RATE_LIMIT]: GitHub API rate limit exceeded');
  });

  it('exits 2 on an error that is not a SyncError', async () => {
    vi.mocked(audit).mockRejectedValue(new Error('socket hang up'));
    const run = await runCli(['audit']);
    expect(run.code).toBe(2);
    expect(run.stderr).toContain('Unexpected error: Error: socket hang up');
  });
});
