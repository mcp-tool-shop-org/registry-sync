import { fetchNpm } from '../fetch.js';
import type { NpmPackageInfo } from '../types.js';

interface NpmRegistryResponse {
  name: string;
  'dist-tags'?: {
    latest?: string;
  };
  modified?: string;
}

/**
 * Get npm package metadata (latest version + last publish date).
 * Returns null if package doesn't exist on npmjs.
 */
export async function getNpmPackageInfo(
  packageName: string,
): Promise<NpmPackageInfo | null> {
  const encoded = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encoded}`;

  const data = await fetchNpm<NpmRegistryResponse>(url);
  if (!data) return null;

  const latestVersion = data['dist-tags']?.latest;
  if (!latestVersion) return null;

  const lastPublished = data.modified || '';

  return {
    name: data.name,
    latestVersion,
    lastPublished,
  };
}
