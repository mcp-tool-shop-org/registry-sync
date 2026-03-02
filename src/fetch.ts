import { SyncError, wrapError } from './errors.js';
import { getGitHubToken } from './auth.js';

const RETRYABLE = new Set([429, 500, 502, 503, 504]);
const MAX_RETRIES = 3;
const BASE_DELAY = 1000;

// --- Per-source throttle (mutex pattern from registry-stats) ---

const locks = new Map<string, Promise<void>>();

const SOURCE_DELAYS: Record<string, number> = {
  github: 100,  // 5000/hr → ~1.4/s, 100ms is conservative
  npm: 400,     // safe for bulk reads
};

function acquireSlot(source: string): Promise<void> {
  const delay = SOURCE_DELAYS[source] ?? 100;
  const prev = locks.get(source) ?? Promise.resolve();
  const slot = prev.then(() => new Promise<void>((r) => setTimeout(r, delay)));
  locks.set(source, slot);
  return prev;
}

// --- Concurrency limiter ---

export function pLimit(concurrency: number) {
  let active = 0;
  const queue: (() => void)[] = [];

  return async <T>(fn: () => Promise<T>): Promise<T> => {
    if (active >= concurrency) {
      await new Promise<void>((resolve) => queue.push(resolve));
    }
    active++;
    try {
      return await fn();
    } finally {
      active--;
      queue.shift()?.();
    }
  };
}

// --- GitHub API fetch ---

export async function fetchGitHub<T>(path: string): Promise<T | null> {
  const token = getGitHubToken();
  const url = path.startsWith('https://')
    ? path
    : `https://api.github.com${path}`;

  await acquireSlot('github');

  let lastError: SyncError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      });
    } catch (err) {
      lastError = wrapError(err, 'GITHUB_API', 'Network error calling GitHub API');
      if (attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, BASE_DELAY * 2 ** attempt));
      continue;
    }

    if (res.status === 404) return null;
    if (res.ok) return res.json() as Promise<T>;

    if (res.status === 403) {
      const remaining = res.headers.get('x-ratelimit-remaining');
      if (remaining === '0') {
        const resetAt = res.headers.get('x-ratelimit-reset');
        const resetDate = resetAt ? new Date(Number(resetAt) * 1000).toISOString() : 'unknown';
        throw new SyncError(
          'GITHUB_RATE_LIMIT',
          `GitHub API rate limit exceeded, resets at ${resetDate}`,
          'Wait for rate limit reset or use a token with higher limits',
        );
      }
    }

    lastError = new SyncError(
      'GITHUB_API',
      `GitHub API ${res.status}: ${res.statusText} (${url})`,
      'Check token permissions and API status',
      { retryable: RETRYABLE.has(res.status) },
    );

    if (!RETRYABLE.has(res.status) || attempt === MAX_RETRIES) break;

    const retryAfter = res.headers.get('retry-after');
    const backoff = BASE_DELAY * 2 ** attempt;
    const retryMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 0;
    await new Promise((r) => setTimeout(r, Math.max(backoff, retryMs)));
  }

  throw lastError!;
}

/** Paginated GitHub API fetch — follows Link: <next> headers. */
export async function fetchGitHubPaginated<T>(path: string): Promise<T[]> {
  const results: T[] = [];
  let url: string | null = path.startsWith('https://')
    ? path
    : `https://api.github.com${path}`;

  while (url) {
    const token = getGitHubToken();
    await acquireSlot('github');

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });

    if (!res.ok) {
      throw new SyncError(
        'GITHUB_API',
        `GitHub API ${res.status}: ${res.statusText}`,
        'Check token permissions',
      );
    }

    const data = (await res.json()) as T[];
    results.push(...data);

    // Parse Link header for next page
    const link = res.headers.get('link');
    url = null;
    if (link) {
      const match = link.match(/<([^>]+)>;\s*rel="next"/);
      if (match) url = match[1];
    }
  }

  return results;
}

// --- npm registry fetch ---

export async function fetchNpm<T>(url: string): Promise<T | null> {
  await acquireSlot('npm');

  let lastError: SyncError | undefined;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    let res: Response;
    try {
      res = await fetch(url, {
        headers: { Accept: 'application/json' },
      });
    } catch (err) {
      lastError = wrapError(err, 'NPM_API', 'Network error calling npm registry');
      if (attempt === MAX_RETRIES) break;
      await new Promise((r) => setTimeout(r, BASE_DELAY * 2 ** attempt));
      continue;
    }

    if (res.status === 404) return null;
    if (res.ok) return res.json() as Promise<T>;

    lastError = new SyncError(
      'NPM_API',
      `npm API ${res.status}: ${res.statusText} (${url})`,
      'The package may not exist or npm may be rate-limiting',
      { retryable: RETRYABLE.has(res.status) },
    );

    if (!RETRYABLE.has(res.status) || attempt === MAX_RETRIES) break;
    await new Promise((r) => setTimeout(r, BASE_DELAY * 2 ** attempt));
  }

  throw lastError!;
}
