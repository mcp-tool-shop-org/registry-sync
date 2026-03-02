import { fetchNpm } from '../fetch.js';
import type { NpmPackageInfo } from '../types.js';

interface NpmRegistryResponse {
  name: string;
  'dist-tags'?: {
    latest?: string;
  };
  time?: Record<string, string>;
  versions?: Record<string, unknown>;
}

/**
 * Get npm package metadata (latest version + last publish date).
 * Returns null if package doesn't exist on npmjs.
 */
export async function getNpmPackageInfo(
  packageName: string,
): Promise<NpmPackageInfo | null> {
  // Use abbreviated metadata for speed
  const encoded = encodeURIComponent(packageName);
  const url = `https://registry.npmjs.org/${encoded}`;

  const data = await fetchNpm<NpmRegistryResponse>(url);
  if (!data) return null;

  const latestVersion = data['dist-tags']?.latest;
  if (!latestVersion) return null;

  // Get last publish time from the `time` field
  let lastPublished = '';
  if (data.time) {
    // time.modified is the most recent publish
    lastPublished = data.time.modified || data.time[latestVersion] || '';
  }

  return {
    name: data.name,
    latestVersion,
    lastPublished,
  };
}
