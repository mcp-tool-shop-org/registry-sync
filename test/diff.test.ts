import { describe, it, expect } from 'vitest';
import { diff } from '../src/diff.js';
import type { AuditResult, AuditRow, OrphanEntry } from '../src/types.js';

function makeAudit(overrides?: Partial<AuditResult>): AuditResult {
  return {
    org: 'test-org',
    generatedAt: '2026-01-01T00:00:00Z',
    repoCount: 0,
    rows: [],
    orphans: [],
    ...overrides,
  };
}

function makeRow(name: string, drift: 'current' | 'behind' | 'ahead' | 'missing', version?: string): AuditRow {
  return {
    repo: {
      name,
      fullName: `test-org/${name}`,
      language: 'TypeScript',
      archived: false,
      isPrivate: false,
      pushedAt: '2026-01-01',
      topics: [],
      defaultBranch: 'main',
      hasPackageJson: true,
      hasDockerfile: false,
      packageJsonVersion: '1.0.0',
    },
    presence: [
      {
        registry: 'npmjs',
        published: drift !== 'missing',
        publishedVersion: version,
        drift,
      },
    ],
  };
}

describe('diff', () => {
  it('returns empty entries for identical audits', () => {
    const audit = makeAudit({
      rows: [makeRow('tool-a', 'current', '1.0.0')],
    });
    const result = diff(audit, audit);
    expect(result.entries).toHaveLength(1);
    expect(result.entries[0].change).toBe('unchanged');
    expect(result.summary.unchanged).toBe(1);
  });

  it('detects new_drift when current becomes behind', () => {
    const before = makeAudit({ rows: [makeRow('tool-a', 'current', '1.0.0')] });
    const after = makeAudit({
      generatedAt: '2026-01-02T00:00:00Z',
      rows: [makeRow('tool-a', 'behind', '1.0.0')],
    });
    const result = diff(before, after);
    expect(result.entries[0].change).toBe('new_drift');
    expect(result.summary.newDrift).toBe(1);
  });

  it('detects resolved when behind becomes current', () => {
    const before = makeAudit({ rows: [makeRow('tool-a', 'behind', '1.0.0')] });
    const after = makeAudit({
      generatedAt: '2026-01-02T00:00:00Z',
      rows: [makeRow('tool-a', 'current', '2.0.0')],
    });
    const result = diff(before, after);
    expect(result.entries[0].change).toBe('resolved');
    expect(result.summary.resolved).toBe(1);
  });

  it('detects worsened when behind becomes missing', () => {
    const before = makeAudit({ rows: [makeRow('tool-a', 'behind', '1.0.0')] });
    const after = makeAudit({
      generatedAt: '2026-01-02T00:00:00Z',
      rows: [makeRow('tool-a', 'missing')],
    });
    const result = diff(before, after);
    expect(result.entries[0].change).toBe('worsened');
    expect(result.summary.worsened).toBe(1);
  });

  it('detects new_repo when repo appears in after only', () => {
    const before = makeAudit({ rows: [] });
    const after = makeAudit({
      generatedAt: '2026-01-02T00:00:00Z',
      rows: [makeRow('new-tool', 'current', '1.0.0')],
    });
    const result = diff(before, after);
    expect(result.entries[0].change).toBe('new_repo');
    expect(result.summary.newRepos).toBe(1);
  });

  it('detects removed_repo when repo disappears in after', () => {
    const before = makeAudit({ rows: [makeRow('old-tool', 'current', '1.0.0')] });
    const after = makeAudit({ generatedAt: '2026-01-02T00:00:00Z', rows: [] });
    const result = diff(before, after);
    expect(result.entries[0].change).toBe('removed_repo');
    expect(result.summary.removedRepos).toBe(1);
  });

  it('sorts entries by severity (new_drift before unchanged)', () => {
    const before = makeAudit({
      rows: [
        makeRow('stable', 'current', '1.0.0'),
        makeRow('drifting', 'current', '1.0.0'),
      ],
    });
    const after = makeAudit({
      generatedAt: '2026-01-02T00:00:00Z',
      rows: [
        makeRow('stable', 'current', '1.0.0'),
        makeRow('drifting', 'behind', '1.0.0'),
      ],
    });
    const result = diff(before, after);
    expect(result.entries[0].change).toBe('new_drift');
    expect(result.entries[0].repo).toBe('drifting');
    expect(result.entries[1].change).toBe('unchanged');
  });

  it('detects added orphans', () => {
    const before = makeAudit({ orphans: [] });
    const orphan: OrphanEntry = { registry: 'npmjs', packageName: 'ghost-pkg' };
    const after = makeAudit({
      generatedAt: '2026-01-02T00:00:00Z',
      orphans: [orphan],
    });
    const result = diff(before, after);
    expect(result.orphans.added).toHaveLength(1);
    expect(result.orphans.added[0].packageName).toBe('ghost-pkg');
    expect(result.summary.newOrphans).toBe(1);
  });

  it('detects removed orphans', () => {
    const orphan: OrphanEntry = { registry: 'ghcr', packageName: 'cleaned-up' };
    const before = makeAudit({ orphans: [orphan] });
    const after = makeAudit({
      generatedAt: '2026-01-02T00:00:00Z',
      orphans: [],
    });
    const result = diff(before, after);
    expect(result.orphans.removed).toHaveLength(1);
    expect(result.orphans.removed[0].packageName).toBe('cleaned-up');
    expect(result.summary.removedOrphans).toBe(1);
  });

  it('populates org and date fields from inputs', () => {
    const before = makeAudit({ org: 'my-org', generatedAt: '2026-01-01T00:00:00Z' });
    const after = makeAudit({ org: 'my-org', generatedAt: '2026-01-15T00:00:00Z' });
    const result = diff(before, after);
    expect(result.org).toBe('my-org');
    expect(result.beforeDate).toBe('2026-01-01T00:00:00Z');
    expect(result.afterDate).toBe('2026-01-15T00:00:00Z');
  });

  it('includes details string for each entry', () => {
    const before = makeAudit({ rows: [makeRow('tool-a', 'behind', '0.9.0')] });
    const after = makeAudit({
      generatedAt: '2026-01-02T00:00:00Z',
      rows: [makeRow('tool-a', 'current', '1.0.0')],
    });
    const result = diff(before, after);
    expect(result.entries[0].details).toBeTruthy();
    expect(typeof result.entries[0].details).toBe('string');
  });
});
