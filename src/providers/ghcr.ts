import { fetchGitHub } from '../fetch.js';
import type { ContainerPackage } from '../types.js';

interface GitHubPackage {
  name: string;
  package_type: string;
  created_at: string;
  updated_at: string;
  visibility: string;
}

/**
 * List all container packages in the org via GitHub Packages API.
 * This is the same function as github.ts listContainerPackages,
 * but kept here as the canonical GHCR provider entry point.
 */
export async function listGhcrPackages(
  org: string,
): Promise<ContainerPackage[]> {
  const results: ContainerPackage[] = [];
  let url: string | null =
    `https://api.github.com/orgs/${org}/packages?package_type=container&per_page=100`;

  while (url) {
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN || '';
    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      // Packages API may return 403 if org hasn't enabled packages
      if (res.status === 403 || res.status === 404) return [];
      break;
    }

    const data = (await res.json()) as GitHubPackage[];
    results.push(
      ...data.map((p) => ({
        name: p.name,
        packageType: p.package_type,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        visibility: p.visibility,
      })),
    );

    const link = res.headers.get('link');
    url = null;
    if (link) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/);
      if (match) url = match[1];
    }
  }

  return results;
}

/**
 * Check if a specific container package exists in the org.
 */
export async function getGhcrPackage(
  org: string,
  name: string,
): Promise<ContainerPackage | null> {
  const data = await fetchGitHub<GitHubPackage>(
    `/orgs/${org}/packages/container/${encodeURIComponent(name)}`,
  );
  if (!data) return null;

  return {
    name: data.name,
    packageType: data.package_type,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    visibility: data.visibility,
  };
}
