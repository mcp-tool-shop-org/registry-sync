/**
 * Minimal semver comparison. Handles major.minor.patch only.
 * Pre-release suffixes are stripped before comparison.
 */

function parse(version: string): [number, number, number] | null {
  const clean = version.replace(/^v/, '').split('-')[0].split('+')[0];
  const parts = clean.split('.');
  if (parts.length < 3) return null;
  const nums = parts.slice(0, 3).map(Number);
  if (nums.some(isNaN)) return null;
  return nums as [number, number, number];
}

/** Returns -1 if a < b, 0 if equal, 1 if a > b. null if unparseable. */
export function compareSemver(a: string, b: string): number | null {
  const pa = parse(a);
  const pb = parse(b);
  if (!pa || !pb) return null;
  for (let i = 0; i < 3; i++) {
    if (pa[i] > pb[i]) return 1;
    if (pa[i] < pb[i]) return -1;
  }
  return 0;
}

/** True if `repo` version is greater than `published` version. */
export function isDrift(repo: string, published: string): boolean {
  const cmp = compareSemver(repo, published);
  return cmp === 1;
}
