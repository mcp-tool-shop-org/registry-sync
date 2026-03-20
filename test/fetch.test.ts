import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';
import { pLimit, fetchGitHub, fetchGitHubPaginated, fetchNpm } from '../src/fetch.js';

vi.mock('../src/auth.js', () => ({ getGitHubToken: () => 'test-token' }));

// Use fake timers for the entire file to handle throttle + retry delays
beforeAll(() => { vi.useFakeTimers(); });
afterAll(() => { vi.useRealTimers(); });

let mockFetch: ReturnType<typeof vi.fn>;

beforeEach(async () => {
  mockFetch = vi.fn();
  vi.stubGlobal('fetch', mockFetch);
  // Flush any pending acquireSlot timers from previous tests
  await vi.runAllTimersAsync();
});

/** Start an async operation, flush all fake timers, then await the result. */
async function flush<T>(p: Promise<T>): Promise<T> {
  // Prevent "unhandled rejection" while we advance timers —
  // the rejection still propagates via `return p`.
  p.catch(() => {});
  await vi.runAllTimersAsync();
  return p;
}

// ---------------------------------------------------------------------------
// pLimit
// ---------------------------------------------------------------------------

describe('pLimit', () => {
  it('runs tasks sequentially with concurrency 1', async () => {
    const limit = pLimit(1);
    const events: string[] = [];

    const task = (id: number) => limit(async () => {
      events.push(`start-${id}`);
      await new Promise(r => setTimeout(r, 10));
      events.push(`end-${id}`);
      return id;
    });

    const promises = [task(1), task(2)];
    await vi.runAllTimersAsync();
    const results = await Promise.all(promises);

    expect(results).toEqual([1, 2]);
    expect(events).toEqual(['start-1', 'end-1', 'start-2', 'end-2']);
  });

  it('runs up to N tasks concurrently', async () => {
    const limit = pLimit(3);
    let concurrent = 0;
    let maxConcurrent = 0;

    const task = () => limit(async () => {
      concurrent++;
      maxConcurrent = Math.max(maxConcurrent, concurrent);
      await new Promise(r => setTimeout(r, 10));
      concurrent--;
    });

    const promises = [task(), task(), task(), task()];
    await vi.runAllTimersAsync();
    await Promise.all(promises);

    expect(maxConcurrent).toBe(3);
  });

  it('releases slot when task throws', async () => {
    const limit = pLimit(1);

    const p1 = limit(async () => { throw new Error('fail'); });
    p1.catch(() => {}); // prevent unhandled rejection before timers advance
    const p2 = limit(async () => 'ok');

    await vi.runAllTimersAsync();
    await expect(p1).rejects.toThrow('fail');
    expect(await p2).toBe('ok');
  });

  it('forwards return values', async () => {
    const limit = pLimit(2);
    const result = await limit(async () => 42);
    expect(result).toBe(42);
  });
});

// ---------------------------------------------------------------------------
// fetchGitHub
// ---------------------------------------------------------------------------

describe('fetchGitHub', () => {
  it('returns parsed JSON on 200', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ data: 1 }), { status: 200 }));
    const result = await flush(fetchGitHub('/test'));
    expect(result).toEqual({ data: 1 });
  });

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    const result = await flush(fetchGitHub('/test'));
    expect(result).toBeNull();
  });

  it('throws GITHUB_RATE_LIMIT on 403 with x-ratelimit-remaining: 0', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0', 'x-ratelimit-reset': '1700000000' },
    }));
    try {
      await flush(fetchGitHub('/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_RATE_LIMIT');
      expect(err.message).toContain('2023');
    }
  });

  it('shows unknown when x-ratelimit-reset header is absent', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', {
      status: 403,
      headers: { 'x-ratelimit-remaining': '0' },
    }));
    try {
      await flush(fetchGitHub('/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_RATE_LIMIT');
      expect(err.message).toContain('unknown');
    }
  });

  it('throws GITHUB_API on 403 without rate limit', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 403, statusText: 'Forbidden' }));
    try {
      await flush(fetchGitHub('/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_API');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('retries on 429 then succeeds', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 429, statusText: 'Too Many' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await flush(fetchGitHub('/test'));
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it.each([500, 502, 503, 504])('retries on %i then succeeds', async (status) => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status, statusText: 'Error' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await flush(fetchGitHub('/test'));
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 400', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 400, statusText: 'Bad Request' }));
    try {
      await flush(fetchGitHub('/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_API');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('does NOT retry on 401', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 401, statusText: 'Unauthorized' }));
    try {
      await flush(fetchGitHub('/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_API');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('respects retry-after header', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 429, headers: { 'retry-after': '5' } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await flush(fetchGitHub('/test'));
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws after MAX_RETRIES on retryable errors', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Error' }))
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Error' }))
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Error' }))
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Error' }));
    try {
      await flush(fetchGitHub('/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_API');
    }
    expect(mockFetch).toHaveBeenCalledTimes(4); // initial + 3 retries
  });

  it('throws on network error after MAX_RETRIES', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    try {
      await flush(fetchGitHub('/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_API');
    }
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('prepends GitHub API URL to relative paths', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await flush(fetchGitHub('/repos/test'));
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.github.com/repos/test');
  });

  it('passes through absolute URLs', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await flush(fetchGitHub('https://api.github.com/custom'));
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.github.com/custom');
  });

  it('sends correct headers', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await flush(fetchGitHub('/test'));
    const headers = mockFetch.mock.calls[0][1].headers;
    expect(headers.Authorization).toBe('Bearer test-token');
    expect(headers.Accept).toBe('application/vnd.github+json');
    expect(headers['X-GitHub-Api-Version']).toBe('2022-11-28');
  });
});

// ---------------------------------------------------------------------------
// fetchGitHubPaginated
// ---------------------------------------------------------------------------

describe('fetchGitHubPaginated', () => {
  it('returns items from single page', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), { status: 200 }));
    const result = await flush(fetchGitHubPaginated('/test'));
    expect(result).toEqual([{ id: 1 }]);
  });

  it('follows Link next header across pages', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 1 }]), {
        status: 200,
        headers: { link: '<https://api.github.com/test?page=2>; rel="next"' },
      }))
      .mockResolvedValueOnce(new Response(JSON.stringify([{ id: 2 }]), { status: 200 }));
    const result = await flush(fetchGitHubPaginated('/test'));
    expect(result).toEqual([{ id: 1 }, { id: 2 }]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('throws on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 403, statusText: 'Forbidden' }));
    try {
      await flush(fetchGitHubPaginated('/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('GITHUB_API');
    }
  });

  it('works with absolute URL', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify([]), { status: 200 }));
    await flush(fetchGitHubPaginated('https://api.github.com/custom'));
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.github.com/custom');
  });
});

// ---------------------------------------------------------------------------
// fetchNpm
// ---------------------------------------------------------------------------

describe('fetchNpm', () => {
  it('returns parsed JSON on 200', async () => {
    mockFetch.mockResolvedValueOnce(new Response(JSON.stringify({ name: 'test' }), { status: 200 }));
    const result = await flush(fetchNpm('https://registry.npmjs.org/test'));
    expect(result).toEqual({ name: 'test' });
  });

  it('returns null on 404', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 404 }));
    const result = await flush(fetchNpm('https://registry.npmjs.org/test'));
    expect(result).toBeNull();
  });

  it('retries on 429', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 429, statusText: 'Too Many' }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true }), { status: 200 }));
    const result = await flush(fetchNpm('https://registry.npmjs.org/test'));
    expect(result).toEqual({ ok: true });
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it('does NOT retry on 400', async () => {
    mockFetch.mockResolvedValueOnce(new Response('', { status: 400, statusText: 'Bad' }));
    try {
      await flush(fetchNpm('https://registry.npmjs.org/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('NPM_API');
    }
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('throws after MAX_RETRIES exhausted', async () => {
    mockFetch
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Error' }))
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Error' }))
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Error' }))
      .mockResolvedValueOnce(new Response('', { status: 500, statusText: 'Error' }));
    try {
      await flush(fetchNpm('https://registry.npmjs.org/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('NPM_API');
    }
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('throws on network error after retries', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'))
      .mockRejectedValueOnce(new Error('ECONNREFUSED'));
    try {
      await flush(fetchNpm('https://registry.npmjs.org/test'));
      expect.fail('should throw');
    } catch (err: any) {
      expect(err.code).toBe('NPM_API');
    }
    expect(mockFetch).toHaveBeenCalledTimes(4);
  });

  it('sends npm Accept header', async () => {
    mockFetch.mockResolvedValueOnce(new Response('{}', { status: 200 }));
    await flush(fetchNpm('https://registry.npmjs.org/test'));
    expect(mockFetch.mock.calls[0][1].headers.Accept).toBe('application/vnd.npm.install.v1+json');
  });
});
