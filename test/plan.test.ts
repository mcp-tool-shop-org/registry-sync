import { describe, it, expect } from 'vitest';
import { plan } from '../src/plan.js';
import type { AuditResult, SyncConfig } from '../src/types.js';

const config: SyncConfig = {
  org: 'test-org',
  exclude: [],
  targets: { npm: { enabled: true }, ghcr: { enabled: true } },
  workflowProfiles: {},
};

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

describe('plan', () => {
  it('generates publish action for missing npm package', () => {
    const audit = makeAudit({
      repoCount: 1,
      rows: [
        {
          repo: {
            name: 'my-tool',
            fullName: 'test-org/my-tool',
            language: 'TypeScript',
            archived: false,
            isPrivate: false,
            pushedAt: '2026-01-01',
            topics: [],
            defaultBranch: 'main',
            hasPackageJson: true,
            hasDockerfile: false,
            packageJsonName: '@test/my-tool',
            packageJsonVersion: '1.0.0',
          },
          presence: [
            { registry: 'npmjs', published: false, drift: 'missing' },
          ],
        },
      ],
    });

    const result = plan(audit, config);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('publish');
    expect(result.actions[0].target).toBe('npmjs');
    expect(result.actions[0].risk).toBe('medium');
    expect(result.summary.publish).toBe(1);
  });

  it('generates update action for behind npm package', () => {
    const audit = makeAudit({
      repoCount: 1,
      rows: [
        {
          repo: {
            name: 'my-tool',
            fullName: 'test-org/my-tool',
            language: 'TypeScript',
            archived: false,
            isPrivate: false,
            pushedAt: '2026-01-01',
            topics: [],
            defaultBranch: 'main',
            hasPackageJson: true,
            hasDockerfile: false,
            packageJsonName: '@test/my-tool',
            packageJsonVersion: '1.2.0',
          },
          presence: [
            {
              registry: 'npmjs',
              published: true,
              publishedVersion: '1.1.0',
              drift: 'behind',
            },
          ],
        },
      ],
    });

    const result = plan(audit, config);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('update');
    expect(result.actions[0].fromVersion).toBe('1.1.0');
    expect(result.actions[0].toVersion).toBe('1.2.0');
    expect(result.summary.update).toBe(1);
  });

  it('generates scaffold-workflow for missing GHCR', () => {
    const audit = makeAudit({
      repoCount: 1,
      rows: [
        {
          repo: {
            name: 'my-tool',
            fullName: 'test-org/my-tool',
            language: 'Python',
            archived: false,
            isPrivate: false,
            pushedAt: '2026-01-01',
            topics: [],
            defaultBranch: 'main',
            hasPackageJson: false,
            hasDockerfile: true,
          },
          presence: [
            { registry: 'ghcr', published: false, drift: 'missing' },
          ],
        },
      ],
    });

    const result = plan(audit, config);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('scaffold-workflow');
    expect(result.actions[0].target).toBe('ghcr');
    expect(result.summary.scaffold).toBe(1);
  });

  it('generates prune action for orphans', () => {
    const audit = makeAudit({
      orphans: [
        {
          registry: 'ghcr',
          packageName: 'old-deleted-tool',
          lastPublished: '2025-01-01',
        },
      ],
    });

    const result = plan(audit, config);
    const pruneActions = result.actions.filter((a) => a.type === 'prune');
    expect(pruneActions).toHaveLength(1);
    expect(pruneActions[0].risk).toBe('high');
    expect(result.summary.prune).toBe(1);
  });

  it('generates skip for current packages', () => {
    const audit = makeAudit({
      repoCount: 1,
      rows: [
        {
          repo: {
            name: 'my-tool',
            fullName: 'test-org/my-tool',
            language: 'TypeScript',
            archived: false,
            isPrivate: false,
            pushedAt: '2026-01-01',
            topics: [],
            defaultBranch: 'main',
            hasPackageJson: true,
            hasDockerfile: false,
            packageJsonName: '@test/my-tool',
            packageJsonVersion: '1.0.0',
          },
          presence: [
            {
              registry: 'npmjs',
              published: true,
              publishedVersion: '1.0.0',
              drift: 'current',
            },
          ],
        },
      ],
    });

    const result = plan(audit, config);
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0].type).toBe('skip');
    expect(result.summary.skip).toBe(1);
  });

  it('respects target filter', () => {
    const audit = makeAudit({
      repoCount: 1,
      rows: [
        {
          repo: {
            name: 'my-tool',
            fullName: 'test-org/my-tool',
            language: 'TypeScript',
            archived: false,
            isPrivate: false,
            pushedAt: '2026-01-01',
            topics: [],
            defaultBranch: 'main',
            hasPackageJson: true,
            hasDockerfile: true,
          },
          presence: [
            { registry: 'npmjs', published: false, drift: 'missing' },
            { registry: 'ghcr', published: false, drift: 'missing' },
          ],
        },
      ],
    });

    const result = plan(audit, config, 'npmjs');
    const targets = result.actions.map((a) => a.target);
    expect(targets).toEqual(['npmjs']);
  });

  it('skips suspected VS Code extensions from npm publish', () => {
    const audit = makeAudit({
      repoCount: 2,
      rows: [
        {
          repo: {
            name: 'my-tool-vscode',
            fullName: 'test-org/my-tool-vscode',
            language: 'TypeScript',
            archived: false,
            isPrivate: false,
            pushedAt: '2026-01-01',
            topics: ['vscode-extension'],
            defaultBranch: 'main',
            hasPackageJson: true,
            hasDockerfile: false,
            packageJsonName: 'my-tool-vscode',
            packageJsonVersion: '1.0.0',
          },
          presence: [
            { registry: 'npmjs', published: false, drift: 'missing' },
          ],
        },
        {
          repo: {
            name: 'real-npm-lib',
            fullName: 'test-org/real-npm-lib',
            language: 'TypeScript',
            archived: false,
            isPrivate: false,
            pushedAt: '2026-01-01',
            topics: ['typescript'],
            defaultBranch: 'main',
            hasPackageJson: true,
            hasDockerfile: false,
            packageJsonName: '@test/real-npm-lib',
            packageJsonVersion: '1.0.0',
          },
          presence: [
            { registry: 'npmjs', published: false, drift: 'missing' },
          ],
        },
      ],
    });

    const result = plan(audit, config);
    const publish = result.actions.filter((a) => a.type === 'publish');
    const skip = result.actions.filter((a) => a.type === 'skip');
    expect(publish).toHaveLength(1);
    expect(publish[0].repo).toBe('real-npm-lib');
    expect(skip).toHaveLength(1);
    expect(skip[0].repo).toBe('my-tool-vscode');
    expect(skip[0].skipReason).toBe('suspected-vscode-extension');
    expect(skip[0].suggestedTarget).toBe('vscode-marketplace');
  });

  it('sorts actions: publish > update > scaffold > prune > skip', () => {
    const audit = makeAudit({
      repoCount: 3,
      rows: [
        {
          repo: {
            name: 'current-tool',
            fullName: 'test-org/current-tool',
            language: null,
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
              published: true,
              publishedVersion: '1.0.0',
              drift: 'current',
            },
          ],
        },
        {
          repo: {
            name: 'missing-tool',
            fullName: 'test-org/missing-tool',
            language: null,
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
            { registry: 'npmjs', published: false, drift: 'missing' },
          ],
        },
        {
          repo: {
            name: 'behind-tool',
            fullName: 'test-org/behind-tool',
            language: null,
            archived: false,
            isPrivate: false,
            pushedAt: '2026-01-01',
            topics: [],
            defaultBranch: 'main',
            hasPackageJson: true,
            hasDockerfile: false,
            packageJsonVersion: '2.0.0',
          },
          presence: [
            {
              registry: 'npmjs',
              published: true,
              publishedVersion: '1.0.0',
              drift: 'behind',
            },
          ],
        },
      ],
      orphans: [{ registry: 'ghcr', packageName: 'orphan-pkg' }],
    });

    const result = plan(audit, config);
    const types = result.actions.map((a) => a.type);
    expect(types).toEqual(['publish', 'update', 'prune', 'skip']);
  });
});
