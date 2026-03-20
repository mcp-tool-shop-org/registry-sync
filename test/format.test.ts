import { describe, it, expect } from 'vitest';
import { formatAuditTable, formatPlanTable } from '../src/format/table.js';
import { formatAuditJson, formatPlanJson, formatApplyJson } from '../src/format/json.js';
import { formatAuditMarkdown, formatPlanMarkdown } from '../src/format/markdown.js';
import type { AuditResult, PlanResult, ApplyResult } from '../src/types.js';

const auditResult: AuditResult = {
  org: 'test-org',
  generatedAt: '2026-01-01T00:00:00Z',
  repoCount: 2,
  rows: [
    {
      repo: {
        name: 'tool-a',
        fullName: 'test-org/tool-a',
        language: 'TypeScript',
        archived: false,
        isPrivate: false,
        pushedAt: '2026-01-01',
        topics: [],
        defaultBranch: 'main',
        hasPackageJson: true,
        hasDockerfile: false,
        packageJsonName: '@test/tool-a',
        packageJsonVersion: '1.0.0',
      },
      presence: [
        { registry: 'npmjs', published: true, publishedVersion: '1.0.0', drift: 'current' },
      ],
    },
    {
      repo: {
        name: 'tool-b',
        fullName: 'test-org/tool-b',
        language: 'TypeScript',
        archived: false,
        isPrivate: false,
        pushedAt: '2026-01-01',
        topics: [],
        defaultBranch: 'main',
        hasPackageJson: true,
        hasDockerfile: true,
        packageJsonName: '@test/tool-b',
        packageJsonVersion: '2.0.0',
      },
      presence: [
        { registry: 'npmjs', published: true, publishedVersion: '1.0.0', drift: 'behind' },
        { registry: 'ghcr', published: false, drift: 'missing' },
      ],
    },
  ],
  orphans: [
    { registry: 'ghcr', packageName: 'old-tool', lastPublished: '2025-06-01' },
  ],
};

const planResult: PlanResult = {
  org: 'test-org',
  generatedAt: '2026-01-01T00:00:00Z',
  actions: [
    { type: 'publish', target: 'npmjs', repo: 'tool-c', details: 'Not published', risk: 'medium' },
    { type: 'update', target: 'npmjs', repo: 'tool-b', fromVersion: '1.0.0', toVersion: '2.0.0', details: 'Behind', risk: 'low' },
    { type: 'skip', target: 'npmjs', repo: 'tool-a', details: 'Up to date', risk: 'low', skipReason: 'current' },
  ],
  summary: { publish: 1, update: 1, scaffold: 0, prune: 0, skip: 1 },
};

describe('table formatter', () => {
  it('formats audit table with repo names and drift indicators', () => {
    const output = formatAuditTable(auditResult);
    expect(output).toContain('test-org');
    expect(output).toContain('tool-a');
    expect(output).toContain('tool-b');
    expect(output).toContain('Orphaned');
    expect(output).toContain('old-tool');
  });

  it('formats plan table with actionable items only', () => {
    const output = formatPlanTable(planResult);
    expect(output).toContain('tool-c');
    expect(output).toContain('tool-b');
    // Skip actions should NOT appear in table
    expect(output).not.toContain('tool-a');
    expect(output).toContain('Summary');
  });

  it('shows sync message for empty plan', () => {
    const emptyPlan: PlanResult = {
      org: 'test-org',
      generatedAt: '2026-01-01T00:00:00Z',
      actions: [{ type: 'skip', target: 'npmjs', repo: 'x', details: '', risk: 'low', skipReason: 'current' }],
      summary: { publish: 0, update: 0, scaffold: 0, prune: 0, skip: 1 },
    };
    const output = formatPlanTable(emptyPlan);
    expect(output).toContain('in sync');
  });
});

describe('json formatter', () => {
  it('formats audit as valid JSON', () => {
    const output = formatAuditJson(auditResult);
    const parsed = JSON.parse(output);
    expect(parsed.org).toBe('test-org');
    expect(parsed.rows).toHaveLength(2);
  });

  it('formats plan as valid JSON', () => {
    const output = formatPlanJson(planResult);
    const parsed = JSON.parse(output);
    expect(parsed.summary.publish).toBe(1);
  });

  it('formats apply result as valid JSON', () => {
    const applyResult: ApplyResult = {
      org: 'test-org',
      appliedAt: '2026-01-01T00:00:00Z',
      results: [],
      summary: { succeeded: 0, failed: 0, skipped: 0 },
    };
    const output = formatApplyJson(applyResult);
    const parsed = JSON.parse(output);
    expect(parsed.summary.succeeded).toBe(0);
  });
});

describe('markdown formatter', () => {
  it('formats audit as markdown table', () => {
    const output = formatAuditMarkdown(auditResult);
    expect(output).toContain('# Registry Audit: test-org');
    expect(output).toContain('| tool-a |');
    expect(output).toContain('| tool-b |');
    expect(output).toContain('Orphaned');
    expect(output).toContain('old-tool');
  });

  it('formats plan as markdown table', () => {
    const output = formatPlanMarkdown(planResult);
    expect(output).toContain('# Sync Plan: test-org');
    expect(output).toContain('| publish |');
    expect(output).toContain('| update |');
    expect(output).toContain('**Summary:**');
  });

  it('shows sync message for empty plan', () => {
    const emptyPlan: PlanResult = {
      org: 'test-org',
      generatedAt: '2026-01-01T00:00:00Z',
      actions: [],
      summary: { publish: 0, update: 0, scaffold: 0, prune: 0, skip: 0 },
    };
    const output = formatPlanMarkdown(emptyPlan);
    expect(output).toContain('in sync');
  });

  it('renders ahead drift status', () => {
    const aheadAudit: AuditResult = {
      org: 'test-org',
      generatedAt: '2026-01-01T00:00:00Z',
      repoCount: 1,
      rows: [{
        repo: {
          name: 'tool-x',
          fullName: 'test-org/tool-x',
          language: null,
          archived: false,
          isPrivate: false,
          pushedAt: '2026-01-01',
          topics: [],
          defaultBranch: 'main',
          hasPackageJson: true,
          hasDockerfile: false,
        },
        presence: [
          { registry: 'npmjs', published: true, publishedVersion: '2.0.0', drift: 'ahead' },
        ],
      }],
      orphans: [],
    };
    const output = formatAuditMarkdown(aheadAudit);
    expect(output).toContain('2.0.0');
  });

  it('renders ahead drift with ⬇️ icon in markdown', () => {
    const aheadAudit: AuditResult = {
      org: 'test-org', generatedAt: '2026-01-01T00:00:00Z', repoCount: 1,
      rows: [{
        repo: {
          name: 'tool-x', fullName: 'test-org/tool-x', language: null,
          archived: false, isPrivate: false, pushedAt: '2026-01-01',
          topics: [], defaultBranch: 'main', hasPackageJson: true, hasDockerfile: false,
        },
        presence: [{ registry: 'npmjs', published: true, publishedVersion: '2.0.0', drift: 'ahead' }],
      }],
      orphans: [],
    };
    const output = formatAuditMarkdown(aheadAudit);
    expect(output).toContain('⬇️');
  });

  it('does NOT include Orphaned section when no orphans', () => {
    const noOrphans: AuditResult = {
      org: 'test-org', generatedAt: '2026-01-01T00:00:00Z', repoCount: 1,
      rows: [{
        repo: {
          name: 'tool', fullName: 'test-org/tool', language: null,
          archived: false, isPrivate: false, pushedAt: '2026-01-01',
          topics: [], defaultBranch: 'main', hasPackageJson: true, hasDockerfile: false,
        },
        presence: [{ registry: 'npmjs', published: true, publishedVersion: '1.0.0', drift: 'current' }],
      }],
      orphans: [],
    };
    const output = formatAuditMarkdown(noOrphans);
    expect(output).not.toContain('Orphaned Packages');
  });

  it('renders risk icons in markdown plan', () => {
    const output = formatPlanMarkdown(planResult);
    expect(output).toContain('🟡'); // medium risk
    expect(output).toContain('🟢'); // low risk
  });

  it('renders private drift as _private_ in markdown', () => {
    const privateAudit: AuditResult = {
      org: 'test-org', generatedAt: '2026-01-01T00:00:00Z', repoCount: 1,
      rows: [{
        repo: {
          name: 'priv-tool', fullName: 'test-org/priv-tool', language: null,
          archived: false, isPrivate: false, pushedAt: '2026-01-01',
          topics: [], defaultBranch: 'main', hasPackageJson: true, hasDockerfile: false,
        },
        presence: [{ registry: 'npmjs', published: false, drift: 'private' }],
      }],
      orphans: [],
    };
    const output = formatAuditMarkdown(privateAudit);
    expect(output).toContain('_private_');
  });
});

// --- Table formatter additional tests ---

describe('table formatter (additional)', () => {
  it('renders ahead drift with ↓ indicator', () => {
    const aheadAudit: AuditResult = {
      org: 'test-org', generatedAt: '2026-01-01T00:00:00Z', repoCount: 1,
      rows: [{
        repo: {
          name: 'tool-x', fullName: 'test-org/tool-x', language: null,
          archived: false, isPrivate: false, pushedAt: '2026-01-01',
          topics: [], defaultBranch: 'main', hasPackageJson: true, hasDockerfile: false,
        },
        presence: [{ registry: 'npmjs', published: true, publishedVersion: '2.0.0', drift: 'ahead' }],
      }],
      orphans: [],
    };
    const output = formatAuditTable(aheadAudit);
    expect(output).toContain('↓');
    expect(output).toContain('2.0.0');
  });

  it('renders private drift in table', () => {
    const privateAudit: AuditResult = {
      org: 'test-org', generatedAt: '2026-01-01T00:00:00Z', repoCount: 1,
      rows: [{
        repo: {
          name: 'priv-tool', fullName: 'test-org/priv-tool', language: null,
          archived: false, isPrivate: false, pushedAt: '2026-01-01',
          topics: [], defaultBranch: 'main', hasPackageJson: true, hasDockerfile: false,
        },
        presence: [{ registry: 'npmjs', published: false, drift: 'private' }],
      }],
      orphans: [],
    };
    const output = formatAuditTable(privateAudit);
    expect(output).toContain('private');
  });

  it('summary line includes correct counts', () => {
    const output = formatAuditTable(auditResult);
    expect(output).toContain('1 current');
    expect(output).toContain('1 behind');
    expect(output).toContain('1 orphans');
  });
});
