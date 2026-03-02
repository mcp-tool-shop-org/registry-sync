import { describe, it, expect } from 'vitest';
import { compareSemver, isDrift } from '../src/semver.js';

describe('compareSemver', () => {
  it('returns 0 for equal versions', () => {
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('2.3.4', '2.3.4')).toBe(0);
  });

  it('returns 1 when a > b (major)', () => {
    expect(compareSemver('2.0.0', '1.0.0')).toBe(1);
  });

  it('returns 1 when a > b (minor)', () => {
    expect(compareSemver('1.2.0', '1.1.0')).toBe(1);
  });

  it('returns 1 when a > b (patch)', () => {
    expect(compareSemver('1.0.2', '1.0.1')).toBe(1);
  });

  it('returns -1 when a < b', () => {
    expect(compareSemver('1.0.0', '2.0.0')).toBe(-1);
    expect(compareSemver('1.0.0', '1.1.0')).toBe(-1);
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1);
  });

  it('strips v prefix', () => {
    expect(compareSemver('v1.0.0', '1.0.0')).toBe(0);
    expect(compareSemver('v2.0.0', 'v1.0.0')).toBe(1);
  });

  it('strips pre-release suffix', () => {
    expect(compareSemver('1.0.0-beta.1', '1.0.0')).toBe(0);
    expect(compareSemver('2.0.0-rc.1', '1.0.0')).toBe(1);
  });

  it('strips build metadata', () => {
    expect(compareSemver('1.0.0+build.123', '1.0.0')).toBe(0);
  });

  it('returns null for invalid versions', () => {
    expect(compareSemver('not-a-version', '1.0.0')).toBeNull();
    expect(compareSemver('1.0', '1.0.0')).toBeNull();
    expect(compareSemver('1.0.0', '')).toBeNull();
  });
});

describe('isDrift', () => {
  it('returns true when repo > published', () => {
    expect(isDrift('1.1.0', '1.0.0')).toBe(true);
    expect(isDrift('2.0.0', '1.9.9')).toBe(true);
  });

  it('returns false when equal', () => {
    expect(isDrift('1.0.0', '1.0.0')).toBe(false);
  });

  it('returns false when repo < published', () => {
    expect(isDrift('1.0.0', '1.1.0')).toBe(false);
  });
});
