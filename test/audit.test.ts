import { describe, it, expect, vi, beforeEach } from 'vitest';
import { audit } from '../src/audit.js';
import { listOrgRepos, readPackageJson, hasDockerfile } from '../src/providers/github.js';
import { getNpmPackageInfo } from '../src/providers/npm.js';
import { listGhcrPackages } from '../src/providers/ghcr.js';
import type { SyncConfig, RepoInfo, NpmPackageInfo, ContainerPackage } from '../src/types.js';
import type { ParsedPackageJson } from '../src/providers/github.js';

vi.mock('../src/providers/github.js');
vi.mock('../src/providers/npm.js');
vi.mock('../src/providers/ghcr.js');

const config: SyncConfig = {
  org: 'test-org',
  exclude: [],
  targets: { npm: { enabled: true }, ghcr: { enabled: true } },
};

function makeRepo(name: string, overrides?: Partial<RepoInfo>): RepoInfo {
  return {
    name,
    fullName: `test-org/${name}`,
    language: 'TypeScript',
    archived: false,
    isPrivate: false,
    pushedAt: '2026-01-01',
    topics: [],
    defaultBranch: 'main',
    hasPackageJson: false,
    hasDockerfile: false,
    ...overrides,
  };
}

interface MockOpts {
  repos?: RepoInfo[];
  packageJsons?: Record<string, ParsedPackageJson | null>;
  dockerfiles?: Record<string, boolean>;
  npmInfos?: Record<string, NpmPackageInfo | null>;
  containers?: ContainerPackage[];
}

function setupMocks(opts: MockOpts = {}) {
  vi.mocked(listOrgRepos).mockResolvedValue(opts.repos ?? []);
  vi.mocked(readPackageJson).mockImplementation(async (_owner, repo) =>
    opts.packageJsons?.[repo] ?? null,
  );
  vi.mocked(hasDockerfile).mockImplementation(async (_owner, repo) =>
    opts.dockerfiles?.[repo] ?? false,
  );
  vi.mocked(getNpmPackageInfo).mockImplementation(async (name) =>
    opts.npmInfos?.[name] ?? null,
  );
  vi.mocked(listGhcrPackages).mockResolvedValue(opts.containers ?? []);
}

beforeEach(() => { vi.resetAllMocks(); });

describe('audit', () => {
  it('returns AuditResult with correct org and repoCount', async () => {
    setupMocks({ repos: [makeRepo('a'), makeRepo('b')] });
    const result = await audit(config);
    expect(result.org).toBe('test-org');
    expect(result.repoCount).toBe(2);
    expect(result.generatedAt).toBeTruthy();
  });

  it('filters out archived repos', async () => {
    setupMocks({ repos: [makeRepo('live'), makeRepo('old', { archived: true })] });
    const result = await audit(config);
    expect(result.repoCount).toBe(1);
    expect(result.rows.every(r => r.repo.name !== 'old')).toBe(true);
  });

  it('filters out excluded repos', async () => {
    setupMocks({ repos: [makeRepo('tool'), makeRepo('brand')] });
    const result = await audit({ ...config, exclude: ['brand'] });
    expect(result.repoCount).toBe(1);
    expect(result.rows.every(r => r.repo.name !== 'brand')).toBe(true);
  });

  it('enriches repos with package.json info', async () => {
    setupMocks({
      repos: [makeRepo('tool')],
      packageJsons: { tool: { name: '@test/tool', version: '1.0.0' } },
    });
    const result = await audit(config);
    expect(result.rows[0].repo.hasPackageJson).toBe(true);
    expect(result.rows[0].repo.packageJsonName).toBe('@test/tool');
    expect(result.rows[0].repo.packageJsonVersion).toBe('1.0.0');
  });

  it('sets hasPackageJson false when readPackageJson returns null', async () => {
    setupMocks({ repos: [makeRepo('tool')] });
    const result = await audit(config);
    expect(result.rows[0].repo.hasPackageJson).toBe(false);
  });

  it('sets drift "current" when versions match', async () => {
    setupMocks({
      repos: [makeRepo('tool')],
      packageJsons: { tool: { name: '@test/tool', version: '1.0.0' } },
      npmInfos: { '@test/tool': { name: '@test/tool', latestVersion: '1.0.0', lastPublished: '2026-01-01' } },
    });
    const result = await audit(config);
    const npm = result.rows[0].presence.find(p => p.registry === 'npmjs');
    expect(npm?.drift).toBe('current');
    expect(npm?.published).toBe(true);
  });

  it('sets drift "behind" when repo version > npm version', async () => {
    setupMocks({
      repos: [makeRepo('tool')],
      packageJsons: { tool: { name: '@test/tool', version: '2.0.0' } },
      npmInfos: { '@test/tool': { name: '@test/tool', latestVersion: '1.0.0', lastPublished: '2026-01-01' } },
    });
    const result = await audit(config);
    expect(result.rows[0].presence[0].drift).toBe('behind');
  });

  it('sets drift "ahead" when npm version > repo version', async () => {
    setupMocks({
      repos: [makeRepo('tool')],
      packageJsons: { tool: { name: '@test/tool', version: '1.0.0' } },
      npmInfos: { '@test/tool': { name: '@test/tool', latestVersion: '2.0.0', lastPublished: '2026-01-01' } },
    });
    const result = await audit(config);
    expect(result.rows[0].presence[0].drift).toBe('ahead');
  });

  it('sets drift "missing" when npm returns null', async () => {
    setupMocks({
      repos: [makeRepo('tool')],
      packageJsons: { tool: { name: '@test/tool', version: '1.0.0' } },
    });
    const result = await audit(config);
    expect(result.rows[0].presence[0].drift).toBe('missing');
  });

  it('skips npm check when npm target disabled', async () => {
    setupMocks({
      repos: [makeRepo('tool')],
      packageJsons: { tool: { name: '@test/tool', version: '1.0.0' } },
    });
    const result = await audit(
      { ...config, targets: { npm: { enabled: false }, ghcr: { enabled: false } } },
    );
    const npm = result.rows[0].presence.find(p => p.registry === 'npmjs');
    expect(npm).toBeUndefined();
  });

  it('skips npm for private packages', async () => {
    setupMocks({
      repos: [makeRepo('tool')],
      packageJsons: { tool: { name: '@test/tool', version: '1.0.0', private: true } },
    });
    const result = await audit(config);
    const npm = result.rows[0].presence.find(p => p.registry === 'npmjs');
    expect(npm?.drift).toBe('private');
    expect(vi.mocked(getNpmPackageInfo)).not.toHaveBeenCalled();
  });

  it('adds row with empty presence for repos without package.json', async () => {
    setupMocks({ repos: [makeRepo('tool')] });
    const result = await audit(config);
    expect(result.rows[0].presence.length).toBe(0);
  });

  it('matches GHCR container to repo by name', async () => {
    setupMocks({
      repos: [makeRepo('my-tool')],
      containers: [{
        name: 'my-tool', packageType: 'container',
        createdAt: '2026-01-01', updatedAt: '2026-01-15', visibility: 'public',
      }],
    });
    const result = await audit(config);
    const ghcr = result.rows[0].presence.find(p => p.registry === 'ghcr');
    expect(ghcr?.published).toBe(true);
    expect(ghcr?.drift).toBe('current');
  });

  it('adds orphan for unmatched GHCR containers', async () => {
    setupMocks({
      repos: [makeRepo('tool')],
      containers: [{
        name: 'orphan-pkg', packageType: 'container',
        createdAt: '2026-01-01', updatedAt: '2026-01-15', visibility: 'public',
      }],
    });
    const result = await audit(config);
    expect(result.orphans).toHaveLength(1);
    expect(result.orphans[0].packageName).toBe('orphan-pkg');
  });

  it('adds GHCR "missing" for repos with Dockerfile but no container', async () => {
    setupMocks({
      repos: [makeRepo('docker-tool')],
      dockerfiles: { 'docker-tool': true },
    });
    const result = await audit(config);
    const ghcr = result.rows[0].presence.find(p => p.registry === 'ghcr');
    expect(ghcr?.drift).toBe('missing');
    expect(ghcr?.published).toBe(false);
  });

  it('does NOT add GHCR missing for repos without Dockerfile', async () => {
    setupMocks({ repos: [makeRepo('no-docker')] });
    const result = await audit(config);
    const ghcr = result.rows[0].presence.find(p => p.registry === 'ghcr');
    expect(ghcr).toBeUndefined();
  });

  it('sorts actionable rows (behind/missing) before current', async () => {
    setupMocks({
      repos: [makeRepo('a-current'), makeRepo('b-behind')],
      packageJsons: {
        'a-current': { name: '@test/a', version: '1.0.0' },
        'b-behind': { name: '@test/b', version: '2.0.0' },
      },
      npmInfos: {
        '@test/a': { name: '@test/a', latestVersion: '1.0.0', lastPublished: '2026-01-01' },
        '@test/b': { name: '@test/b', latestVersion: '1.0.0', lastPublished: '2026-01-01' },
      },
    });
    const result = await audit(config);
    expect(result.rows[0].repo.name).toBe('b-behind');
  });

  it('calls onProgress with correct phases', async () => {
    setupMocks({ repos: [makeRepo('tool')] });
    const phases: string[] = [];
    await audit(config, (p) => { phases.push(p.phase); });
    expect(phases).toContain('Listing repos');
    expect(phases).toContain('Scanning repos');
  });

  it('works when onProgress is undefined', async () => {
    setupMocks({ repos: [] });
    const result = await audit(config);
    expect(result.repoCount).toBe(0);
  });
});
