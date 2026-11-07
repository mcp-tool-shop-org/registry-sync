import { describe, it, expect } from 'vitest';
import { formatDiffTable, formatDiffJson, formatDiffMarkdown } from '../src/format/diff.js';
import type { DiffResult, DiffEntry } from '../src/types.js';

// The table formatter colours its output; assertions read the text underneath.
const stripAnsi = (s: string) => s.replace(/\u001b\[[0-9;]*m/g, '');

const noCounts: DiffResult['summary'] = {
  newDrift: 0,
  resolved: 0,
  worsened: 0,
  unchanged: 0,
  newRepos: 0,
  removedRepos: 0,
  newOrphans: 0,
  removedOrphans: 0,
};

function makeDiff(overrides?: Partial<DiffResult>): DiffResult {
  return {
    org: 'test-org',
    beforeDate: '2026-09-01T00:00:00Z',
    afterDate: '2026-09-24T00:00:00Z',
    entries: [],
    orphans: { added: [], removed: [] },
    summary: noCounts,
    ...overrides,
  };
}

// One entry per change kind, with the details diff() writes for each.
const entries: DiffEntry[] = [
  {
    repo: 'tool-a',
    registry: 'npmjs',
    change: 'new_drift',
    before: { drift: 'current', version: '1.0.0' },
    after: { drift: 'behind', version: '1.0.0' },
    details: 'current → behind (published 1.0.0)',
  },
  {
    repo: 'tool-b',
    registry: 'npmjs',
    change: 'worsened',
    before: { drift: 'behind', version: '1.0.0' },
    after: { drift: 'ahead', version: '3.0.0' },
    details: 'behind → ahead (1.0.0 → 3.0.0)',
  },
  {
    repo: 'tool-c',
    registry: 'ghcr',
    change: 'resolved',
    before: { drift: 'missing' },
    after: { drift: 'current', version: '2.0.0' },
    details: 'missing → current (2.0.0)',
  },
  {
    repo: 'tool-d',
    registry: 'npmjs',
    change: 'new_repo',
    after: { drift: 'missing' },
    details: 'New repo, missing on npmjs',
  },
  {
    repo: 'tool-e',
    registry: 'npmjs',
    change: 'removed_repo',
    before: { drift: 'current', version: '0.9.0' },
    details: 'Repo removed (was current on npmjs)',
  },
  {
    repo: 'tool-f',
    registry: 'npmjs',
    change: 'unchanged',
    before: { drift: 'current', version: '1.2.0' },
    after: { drift: 'current', version: '1.2.0' },
    details: 'Unchanged (current 1.2.0)',
  },
];
const unchangedOnly = [entries[5]];

const orphans: DiffResult['orphans'] = {
  added: [{ registry: 'npmjs', packageName: '@test/stray' }],
  removed: [{ registry: 'ghcr', packageName: 'old-image' }],
};

const fullSummary: DiffResult['summary'] = {
  newDrift: 1,
  resolved: 1,
  worsened: 1,
  unchanged: 1,
  newRepos: 1,
  removedRepos: 1,
  newOrphans: 1,
  removedOrphans: 1,
};

const full = makeDiff({ entries, orphans, summary: fullSummary });

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------

describe('formatDiffTable', () => {
  it('heads the output with the org and both snapshot dates', () => {
    const first = stripAnsi(formatDiffTable(full)).split('\n')[0];
    expect(first).toBe('Diff: test-org  2026-09-01T00:00:00Z → 2026-09-24T00:00:00Z');
  });

  it('says nothing changed when every entry is unchanged and no orphan moved', () => {
    const out = stripAnsi(formatDiffTable(makeDiff({ entries: unchangedOnly, summary: { ...noCounts, unchanged: 1 } })));
    expect(out).toContain('✓ No changes detected.');
    expect(out).not.toContain('Repository');
    expect(out).not.toContain('tool-f');
  });

  it('lists each changed entry with its change, repo, registry and details', () => {
    const out = stripAnsi(formatDiffTable(full));
    expect(out).toMatch(/^Change\s+Repository\s+Registry\s+Details$/m);
    expect(out).toMatch(/^⚠ new_drift\s+tool-a\s+npmjs\s+current → behind \(published 1\.0\.0\)$/m);
    expect(out).toMatch(/^↑ worsened\s+tool-b\s+npmjs\s+behind → ahead \(1\.0\.0 → 3\.0\.0\)$/m);
    expect(out).toMatch(/^✓ resolved\s+tool-c\s+ghcr\s+missing → current \(2\.0\.0\)$/m);
    expect(out).toMatch(/^\+ new_repo\s+tool-d\s+npmjs\s+New repo, missing on npmjs$/m);
    expect(out).toMatch(/^− removed_repo\s+tool-e\s+npmjs\s+Repo removed \(was current on npmjs\)$/m);
  });

  it('leaves unchanged entries out of the rows', () => {
    const out = stripAnsi(formatDiffTable(full));
    expect(out).not.toContain('tool-f');
    expect(out).not.toContain('Unchanged (current 1.2.0)');
  });

  it('lists new and resolved orphans in their own sections', () => {
    const out = stripAnsi(formatDiffTable(full));
    expect(out).toContain('New orphans:\n  + npmjs: @test/stray');
    expect(out).toContain('Resolved orphans:\n  − ghcr: old-image');
  });

  it('shows new orphans without a change table when no entry changed', () => {
    const out = stripAnsi(formatDiffTable(makeDiff({
      entries: unchangedOnly,
      orphans: { added: orphans.added, removed: [] },
      summary: { ...noCounts, unchanged: 1, newOrphans: 1 },
    })));
    expect(out).not.toContain('No changes detected');
    expect(out).not.toContain('Repository');
    expect(out).toContain('New orphans:\n  + npmjs: @test/stray');
    expect(out).not.toContain('Resolved orphans:');
  });

  it('shows resolved orphans on their own when nothing else moved', () => {
    const out = stripAnsi(formatDiffTable(makeDiff({
      orphans: { added: [], removed: orphans.removed },
      summary: { ...noCounts, removedOrphans: 1 },
    })));
    expect(out).not.toContain('No changes detected');
    expect(out).not.toContain('New orphans:');
    expect(out).toContain('Resolved orphans:\n  − ghcr: old-image');
  });

  it('closes with the drift counts from the summary', () => {
    const lines = stripAnsi(formatDiffTable(makeDiff({
      entries,
      summary: { ...noCounts, newDrift: 3, worsened: 2, resolved: 4, unchanged: 7 },
    }))).split('\n');
    expect(lines[lines.length - 1]).toBe('⚠ 3 new drift  2 worsened  ✓ 4 resolved  7 unchanged');
  });

  it('keeps a repository name longer than its column whole', () => {
    const long = 'a-repository-name-longer-than-its-column';
    const out = stripAnsi(formatDiffTable(makeDiff({
      entries: [{ ...entries[0], repo: long }],
      summary: { ...noCounts, newDrift: 1 },
    })));
    expect(out).toContain(`${long} npmjs`);
  });
});

// ---------------------------------------------------------------------------
// JSON
// ---------------------------------------------------------------------------

describe('formatDiffJson', () => {
  it('serialises the whole result, entries and orphans included', () => {
    expect(JSON.parse(formatDiffJson(full))).toEqual(full);
  });

  it('indents with two spaces', () => {
    expect(formatDiffJson(full)).toContain('\n  "org": "test-org"');
  });
});

// ---------------------------------------------------------------------------
// Markdown
// ---------------------------------------------------------------------------

describe('formatDiffMarkdown', () => {
  it('heads the output with the org and both snapshot dates', () => {
    const lines = formatDiffMarkdown(full).split('\n');
    expect(lines[0]).toBe('# Diff: test-org');
    expect(lines[2]).toBe('> 2026-09-01T00:00:00Z → 2026-09-24T00:00:00Z');
  });

  it('says nothing changed, with no summary table, when every entry is unchanged', () => {
    const out = formatDiffMarkdown(makeDiff({ entries: unchangedOnly, summary: { ...noCounts, unchanged: 1 } }));
    expect(out).toContain('> ✅ No changes detected.');
    expect(out).not.toContain('| Change |');
    expect(out).not.toContain('## Summary');
  });

  it('writes one table row per changed entry', () => {
    const out = formatDiffMarkdown(full);
    expect(out).toContain('| Change | Repository | Registry | Details |');
    expect(out).toContain('| 🔴 new_drift | tool-a | npmjs | current → behind (published 1.0.0) |');
    expect(out).toContain('| 🟠 worsened | tool-b | npmjs | behind → ahead (1.0.0 → 3.0.0) |');
    expect(out).toContain('| ✅ resolved | tool-c | ghcr | missing → current (2.0.0) |');
    expect(out).toContain('| 🆕 new_repo | tool-d | npmjs | New repo, missing on npmjs |');
    expect(out).toContain('| 🗑️ removed_repo | tool-e | npmjs | Repo removed (was current on npmjs) |');
    expect(out).not.toContain('tool-f');
  });

  it('lists new and resolved orphans under their own headings', () => {
    const out = formatDiffMarkdown(full);
    expect(out).toContain('## New Orphans\n\n- 🔴 **npmjs**: `@test/stray`');
    expect(out).toContain('## Resolved Orphans\n\n- ✅ **ghcr**: `old-image`');
  });

  it('shows orphan sections without a change table when no entry changed', () => {
    const out = formatDiffMarkdown(makeDiff({
      orphans: { added: orphans.added, removed: [] },
      summary: { ...noCounts, newOrphans: 1 },
    }));
    expect(out).not.toContain('| Change |');
    expect(out).toContain('## New Orphans');
    expect(out).not.toContain('## Resolved Orphans');
    expect(out).toContain('## Summary');
  });

  it('shows resolved orphans on their own when nothing else moved', () => {
    const out = formatDiffMarkdown(makeDiff({
      orphans: { added: [], removed: orphans.removed },
      summary: { ...noCounts, removedOrphans: 1 },
    }));
    expect(out).not.toContain('No changes detected');
    expect(out).not.toContain('## New Orphans');
    expect(out).toContain('## Resolved Orphans');
  });

  it('closes with a summary table carrying all eight counts', () => {
    const out = formatDiffMarkdown(makeDiff({
      entries,
      summary: {
        newDrift: 1,
        worsened: 2,
        resolved: 3,
        unchanged: 4,
        newRepos: 5,
        removedRepos: 6,
        newOrphans: 7,
        removedOrphans: 8,
      },
    }));
    const summary = out.slice(out.indexOf('## Summary'));
    for (const row of [
      '| 🔴 New Drift | 1 |',
      '| 🟠 Worsened | 2 |',
      '| ✅ Resolved | 3 |',
      '| · Unchanged | 4 |',
      '| 🆕 New Repos | 5 |',
      '| 🗑️ Removed Repos | 6 |',
      '| New Orphans | 7 |',
      '| Resolved Orphans | 8 |',
    ]) {
      expect(summary).toContain(row);
    }
  });
});
