import { describe, it, expect } from 'vitest';
import { SyncError, wrapError } from '../src/errors.js';

describe('SyncError', () => {
  it('has correct properties', () => {
    const err = new SyncError('AUTH_MISSING', 'No token', 'Set GITHUB_TOKEN');
    expect(err.code).toBe('AUTH_MISSING');
    expect(err.message).toBe('No token');
    expect(err.hint).toBe('Set GITHUB_TOKEN');
    expect(err.retryable).toBe(false);
    expect(err.name).toBe('SyncError');
  });

  it('supports retryable flag', () => {
    const err = new SyncError('GITHUB_API', 'Rate limited', 'Wait', { retryable: true });
    expect(err.retryable).toBe(true);
  });

  it('supports cause', () => {
    const cause = new Error('network down');
    const err = new SyncError('GITHUB_API', 'Failed', 'Retry', { cause });
    expect(err.cause).toBe(cause);
  });

  it('toCliText formats correctly', () => {
    const err = new SyncError('AUTH_MISSING', 'No token', 'Set GITHUB_TOKEN');
    expect(err.toCliText()).toBe('Error [AUTH_MISSING]: No token\nHint: Set GITHUB_TOKEN');
  });

  it('toJSON serializes correctly', () => {
    const err = new SyncError('NPM_API', 'Failed', 'Check npm', { retryable: true });
    const json = err.toJSON();
    expect(json).toEqual({
      code: 'NPM_API',
      message: 'Failed',
      hint: 'Check npm',
      retryable: true,
    });
  });
});

describe('wrapError', () => {
  it('wraps Error instances', () => {
    const original = new Error('network failure');
    const wrapped = wrapError(original, 'GITHUB_API', 'Check connection');
    expect(wrapped.message).toBe('network failure');
    expect(wrapped.code).toBe('GITHUB_API');
    expect(wrapped.cause).toBe(original);
  });

  it('wraps non-Error values', () => {
    const wrapped = wrapError('string error', 'NPM_API', 'Check npm');
    expect(wrapped.message).toBe('string error');
    expect(wrapped.cause).toBeInstanceOf(Error);
  });
});
