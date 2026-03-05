---
title: Configuration
description: Configure registry-sync with a config file or use it as a library in your own scripts.
sidebar:
  order: 3
---

registry-sync works out of the box with sensible defaults, but you can customize its behavior with a configuration file or use it programmatically as a library.

## Config file

Place a `registry-sync.config.json` in your project root:

```json
{
  "org": "mcp-tool-shop-org",
  "exclude": [".github", "brand"],
  "targets": {
    "npm": { "enabled": true },
    "ghcr": { "enabled": true }
  }
}
```

### Fields

| Field | Type | Description |
|-------|------|-------------|
| `org` | string | GitHub org to scan |
| `exclude` | string[] | Repo names to skip during audit |
| `targets.npm.enabled` | boolean | Enable npm registry auditing |
| `targets.ghcr.enabled` | boolean | Enable GHCR registry auditing |

If no config file is found, registry-sync falls back to defaults. The `--org` CLI flag overrides the config file value.

## Library usage

registry-sync exports its core functions for use in your own scripts and automation:

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

### Exported functions

| Function | Description |
|----------|-------------|
| `loadConfig()` | Reads `registry-sync.config.json` from the current directory, returns defaults if not found |
| `audit(config)` | Runs the full audit, returns the presence matrix |
| `plan(auditResult, config)` | Generates the action plan from audit results |
