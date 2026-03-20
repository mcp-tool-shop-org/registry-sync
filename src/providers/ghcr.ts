import { fetchGitHub, fetchGitHubPaginated } from '../fetch.js';
import type { ContainerPackage } from '../types.js';

interface GitHubPackage {
  name: string;
  package_type: string;
  created_at: string;
  updated_at: string;
  visibility: string;
}

function toContainerPackage(p: GitHubPackage): ContainerPackage {
  return {
    name: p.name,
    packageType: p.package_type,
    createdAt: p.created_at,
    updatedAt: p.updated_at,
    visibility: p.visibility,
  };
}

/**
 * List all container packages in the org via GitHub Packages API.
 * Uses the shared fetchGitHubPaginated helper for auth, retry, and throttle.
 */
export async function listGhcrPackages(
  org: string,
): Promise<ContainerPackage[]> {
  try {
    const raw = await fetchGitHubPaginated<GitHubPackage>(
      `/orgs/${org}/packages?package_type=container&per_page=100`,
    );
    return raw.map(toContainerPackage);
  } catch {
    // Packages API may return 403/404 if org hasn't enabled packages
    return [];
  }
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
  return toContainerPackage(data);
}
