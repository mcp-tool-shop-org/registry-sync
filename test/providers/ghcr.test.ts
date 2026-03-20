import { describe, it, expect, vi, beforeEach } from 'vitest';
import { listGhcrPackages, getGhcrPackage } from '../../src/providers/ghcr.js';
import { fetchGitHub, fetchGitHubPaginated } from '../../src/fetch.js';

vi.mock('../../src/fetch.js');

beforeEach(() => { vi.resetAllMocks(); });

describe('listGhcrPackages', () => {
  it('returns mapped ContainerPackage array', async () => {
    vi.mocked(fetchGitHubPaginated).mockResolvedValue([
      {
        name: 'my-app',
        package_type: 'container',
        created_at: '2026-01-01',
        updated_at: '2026-01-15',
        visibility: 'public',
      },
    ]);
    const packages = await listGhcrPackages('org');
    expect(packages).toHaveLength(1);
    expect(packages[0]).toMatchObject({
      name: 'my-app',
      packageType: 'container',
      createdAt: '2026-01-01',
      updatedAt: '2026-01-15',
      visibility: 'public',
    });
  });

  it('returns empty array when API throws (403/404)', async () => {
    vi.mocked(fetchGitHubPaginated).mockRejectedValue(new Error('403 Forbidden'));
    const packages = await listGhcrPackages('org');
    expect(packages).toEqual([]);
  });
});

describe('getGhcrPackage', () => {
  it('returns ContainerPackage when package exists', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue({
      name: 'my-app',
      package_type: 'container',
      created_at: '2026-01-01',
      updated_at: '2026-01-15',
      visibility: 'public',
    });
    const pkg = await getGhcrPackage('org', 'my-app');
    expect(pkg?.name).toBe('my-app');
  });

  it('returns null when package does not exist', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue(null);
    expect(await getGhcrPackage('org', 'missing')).toBeNull();
  });

  it('URL-encodes the package name', async () => {
    vi.mocked(fetchGitHub).mockResolvedValue(null);
    await getGhcrPackage('org', 'scope/name');
    expect(vi.mocked(fetchGitHub)).toHaveBeenCalledWith(
      expect.stringContaining('scope%2Fname'),
    );
  });
});
