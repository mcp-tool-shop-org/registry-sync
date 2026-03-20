import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseArgs, loadAuditFromFile } from '../src/cli.js';

// ---------------------------------------------------------------------------
// parseArgs
// ---------------------------------------------------------------------------

describe('parseArgs', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {
      throw new Error('process.exit');
    }) as any);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('parses command', () => {
    expect(parseArgs(['audit']).command).toBe('audit');
  });

  it('parses --org', () => {
    const r = parseArgs(['audit', '--org', 'my-org']);
    expect(r.command).toBe('audit');
    expect(r.org).toBe('my-org');
  });

  it('parses --format', () => {
    expect(parseArgs(['audit', '--format', 'json']).format).toBe('json');
  });

  it('parses -f alias', () => {
    expect(parseArgs(['audit', '-f', 'markdown']).format).toBe('markdown');
  });

  it('parses --target', () => {
    expect(parseArgs(['plan', '--target', 'npmjs']).target).toBe('npmjs');
  });

  it('parses --type alias', () => {
    expect(parseArgs(['plan', '--type', 'ghcr']).target).toBe('ghcr');
  });

  it('parses -t alias', () => {
    expect(parseArgs(['plan', '-t', 'all']).target).toBe('all');
  });

  it('parses --confirm', () => {
    expect(parseArgs(['apply', '--confirm']).confirm).toBe(true);
  });

  it('parses --json shorthand', () => {
    expect(parseArgs(['audit', '--json']).format).toBe('json');
  });

  it('parses --out', () => {
    expect(parseArgs(['audit', '--out', 'audit.json']).out).toBe('audit.json');
  });

  it('parses -o alias', () => {
    expect(parseArgs(['-o', 'out.json', 'audit']).out).toBe('out.json');
  });

  it('flags before command still work', () => {
    const r = parseArgs(['-o', 'out.json', 'audit']);
    expect(r.command).toBe('audit');
    expect(r.out).toBe('out.json');
  });

  it('parses --version', () => {
    expect(parseArgs(['--version']).command).toBe('version');
  });

  it('parses -v', () => {
    expect(parseArgs(['-v']).command).toBe('version');
  });

  it('parses --help', () => {
    expect(parseArgs(['--help']).command).toBe('help');
  });

  it('parses -h', () => {
    expect(parseArgs(['-h']).command).toBe('help');
  });

  it('parses --concurrency', () => {
    expect(parseArgs(['--concurrency', '10']).concurrency).toBe(10);
  });

  it('exits on --concurrency 0', () => {
    expect(() => parseArgs(['--concurrency', '0'])).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits on --concurrency 25', () => {
    expect(() => parseArgs(['--concurrency', '25'])).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits on --concurrency NaN', () => {
    expect(() => parseArgs(['--concurrency', 'abc'])).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('parses --limit', () => {
    expect(parseArgs(['--limit', '5']).limit).toBe(5);
  });

  it('exits on --limit 0', () => {
    expect(() => parseArgs(['--limit', '0'])).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('exits on --limit negative', () => {
    expect(() => parseArgs(['--limit', '-3'])).toThrow('process.exit');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('parses --from', () => {
    expect(parseArgs(['--from', 'audit.json']).from).toBe('audit.json');
  });

  it('parses --include-archived', () => {
    expect(parseArgs(['--include-archived']).includeArchived).toBe(true);
  });

  it('parses --no-skip', () => {
    expect(parseArgs(['--no-skip']).noSkip).toBe(true);
  });

  it('parses --repo', () => {
    expect(parseArgs(['audit', '--repo', 'my-tool']).repo).toBe('my-tool');
  });

  it('returns empty command for no args', () => {
    expect(parseArgs([]).command).toBe('');
  });

  it('stores unknown command as command', () => {
    expect(parseArgs(['unknown-cmd']).command).toBe('unknown-cmd');
  });

  it('silently ignores unknown flags', () => {
    const r = parseArgs(['audit', '--bogus']);
    expect(r.command).toBe('audit');
  });
});

// ---------------------------------------------------------------------------
// loadAuditFromFile
// ---------------------------------------------------------------------------

describe('loadAuditFromFile', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = mkdtempSync(join(tmpdir(), 'regsync-'));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loads valid audit JSON', () => {
    const data = { org: 'test', generatedAt: '2026-01-01', repoCount: 0, rows: [], orphans: [] };
    const file = join(tmpDir, 'audit.json');
    writeFileSync(file, JSON.stringify(data));
    const result = loadAuditFromFile(file);
    expect(result.org).toBe('test');
    expect(result.rows).toEqual([]);
  });

  it('throws INPUT_INVALID_FILE for missing org', () => {
    const file = join(tmpDir, 'bad.json');
    writeFileSync(file, JSON.stringify({ rows: [] }));
    expect(() => loadAuditFromFile(file)).toThrow('not a valid audit');
  });

  it('throws INPUT_INVALID_FILE for missing rows', () => {
    const file = join(tmpDir, 'bad.json');
    writeFileSync(file, JSON.stringify({ org: 'test' }));
    expect(() => loadAuditFromFile(file)).toThrow('not a valid audit');
  });

  it('throws INPUT_FILE_NOT_FOUND for nonexistent file', () => {
    expect(() => loadAuditFromFile('/nonexistent/path.json')).toThrow('Could not read');
  });

  it('throws INPUT_FILE_NOT_FOUND for invalid JSON', () => {
    const file = join(tmpDir, 'bad.json');
    writeFileSync(file, '{invalid json');
    expect(() => loadAuditFromFile(file)).toThrow('Could not read');
  });
});
