import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listOrgRepos, readFileContent, readPackageJson, hasDockerfile } from '../../src/providers/github.js';
import { fetchGitHub, fetchGitHubPaginated } from '../../src/fetch.js';

vi.mock('../../src/fetch.js');

beforeEach(() => { vi.resetAllMocks(); });

describe('listOrgRepos', () => {
  it('maps GitHub API fields to RepoInfo shape', async () => {
    vi.mocked(fetchGitHubPaginated).mockResolvedValue([
      {
        name: 'my-tool',
        full_name: 'org/my-tool',
        language: 'TypeScript',
        archived: false,
        private: false,
        pushed_at: '2026-01-01',
        topics: ['mcp'],
        default_branch: 'main',
        fork: false,
      },
    ]);
    const repos = await listOrgRepos('org');
    expect(repos).toHaveLength(1);
    expect(repos[0]).toMatchObject({
      name: 'my-tool',
      fullName: 'org/my-tool',
      language: 'TypeScript',
      isPrivate: false,
      topics: ['mcp'],
      defaultBranch: 'main',
      hasPackageJson: false,
      hasDockerfile: false,
    });
  });

  it('filters out forked repos', async () => {
    vi.mocked(fetchGitHubPaginated).mockResolvedValue([
      { name: 'real', full_name: 'org/real', language: null, archived: false, private: false, pushed_at: '', topics: [], default_branch: 'main', fork: false },
      { name: 'forked', full_name: 'org/forked', language: null, archived: false, private: false, pushed_at: '', topics: [], default_branch: 'main', fork: true },
    ]);
    const repos = await listOrgRepos('org');
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('real');
  });

  it('defaults topics to empty array when undefined', async () => {
    vi.mocked(fetchGitHubPaginated).mockResolvedValue([
      { name: 'x', full_name: 'org/x', language: null, archived: false, private: false, pushed_at: '', default_branch: 'main', fork: false },
    ]);
    const repos = await listOrgRepos('org');
    expect(repos[0].topics).toEqual([]);
  });
});

describe('readFileContent', () => {
  it('returns decoded base64 content', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue({
      type: 'file',
      content: Buffer.from('hello world').toString('base64'),
    });
    const result = await readFileContent('org', 'repo', 'README.md');
    expect(result).toBe('hello world');
  });

  it('returns null when fetchGitHub returns null (404)', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue(null);
    expect(await readFileContent('org', 'repo', 'missing.txt')).toBeNull();
  });

  it('returns null when type is not file', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue({ type: 'dir', content: '' });
    expect(await readFileContent('org', 'repo', 'src')).toBeNull();
  });

  it('returns null when content is missing', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue({ type: 'file' });
    expect(await readFileContent('org', 'repo', 'empty')).toBeNull();
  });
});

describe('readPackageJson', () => {
  it('returns parsed JSON when package.json exists', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue({
      type: 'file',
      content: Buffer.from(JSON.stringify({ name: '@test/pkg', version: '1.0.0' })).toString('base64'),
    });
    const result = await readPackageJson('org', 'repo');
    expect(result).toMatchObject({ name: '@test/pkg', version: '1.0.0' });
  });

  it('returns null when file does not exist', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue(null);
    expect(await readPackageJson('org', 'repo')).toBeNull();
  });

  it('returns null on invalid JSON', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue({
      type: 'file',
      content: Buffer.from('not json').toString('base64'),
    });
    expect(await readPackageJson('org', 'repo')).toBeNull();
  });
});

describe('hasDockerfile', () => {
  it('returns true when Dockerfile exists', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue({ type: 'file', content: '' });
    expect(await hasDockerfile('org', 'repo')).toBe(true);
  });

  it('returns false when Dockerfile does not exist', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue(null);
    expect(await hasDockerfile('org', 'repo')).toBe(false);
  });
});
