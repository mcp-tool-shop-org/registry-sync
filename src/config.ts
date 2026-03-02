import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import type { SyncConfig } from './types.js';
import { SyncError } from './errors.js';

const CONFIG_FILENAME = 'registry-sync.config.json';

export function defaultConfig(): SyncConfig {
  return {
    org: 'mcp-tool-shop-org',
    exclude: ['.github', 'brand', 'mcp-tool-shop.github.io'],
    targets: {
      npm: { enabled: true },
      ghcr: { enabled: true },
    },
    workflowProfiles: {
      'node-lib': 'ci-node-lib.yml',
      'node-cli': 'ci-node-cli.yml',
      container: 'ci-container.yml',
    },
  };
}

export function loadConfig(startDir?: string): SyncConfig {
  const dir = startDir || process.cwd();
  const filePath = findConfigUp(dir);
  if (!filePath) return defaultConfig();

  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<SyncConfig>;
    const defaults = defaultConfig();

    return {
      org: parsed.org || defaults.org,
      exclude: parsed.exclude || defaults.exclude,
      targets: {
        npm: { enabled: parsed.targets?.npm?.enabled ?? defaults.targets.npm.enabled },
        ghcr: { enabled: parsed.targets?.ghcr?.enabled ?? defaults.targets.ghcr.enabled },
      },
      workflowProfiles: parsed.workflowProfiles || defaults.workflowProfiles,
    };
  } catch (err) {
    throw new SyncError(
      'CONFIG_INVALID',
      `Failed to parse ${filePath}`,
      'Ensure the config file is valid JSON',
      { cause: err instanceof Error ? err : undefined },
    );
  }
}

function findConfigUp(startDir: string): string | null {
  let dir = startDir;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const candidate = join(dir, CONFIG_FILENAME);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export function starterConfig(): string {
  return JSON.stringify(defaultConfig(), null, 2) + '\n';
}
