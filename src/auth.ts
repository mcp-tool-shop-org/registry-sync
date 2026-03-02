import { execSync } from 'node:child_process';
import { SyncError } from './errors.js';

let cachedToken: string | undefined;

export function getGitHubToken(): string {
  if (cachedToken) return cachedToken;

  // 1. Env var
  const envToken = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (envToken) {
    cachedToken = envToken;
    return envToken;
  }

  // 2. gh CLI fallback
  try {
    const token = execSync('gh auth token', {
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    }).trim();
    if (token) {
      cachedToken = token;
      return token;
    }
  } catch {
    // gh not installed or not logged in
  }

  throw new SyncError(
    'AUTH_MISSING',
    'No GitHub token found',
    "Set GITHUB_TOKEN env var or run 'gh auth login'",
  );
}
