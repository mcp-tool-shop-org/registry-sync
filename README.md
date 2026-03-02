<p align="center">
  <a href="https://mcp-tool-shop-org.github.io/registry-sync/">
    <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/registry-sync/readme.png" width="400" alt="registry-sync" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/registry-sync/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/registry-sync/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@mcptoolshop/registry-sync"><img src="https://img.shields.io/npm/v/@mcptoolshop/registry-sync" alt="npm" /></a>
  <a href="https://github.com/mcp-tool-shop-org/registry-sync/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://mcp-tool-shop-org.github.io/registry-sync/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page" /></a>
</p>

Desired-state sync engine for multi-registry package publishing. Audits your GitHub org against npmjs and GHCR, detects version drift, finds orphaned packages, and generates action plans — like Terraform for package registries.

The write-side companion to [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Install

```bash
npm install -g @mcptoolshop/registry-sync
```

Or use directly:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## Quick Start

```bash
# Set your GitHub token
export GITHUB_TOKEN=ghp_...

# Audit your org — see what's published, what's drifted, what's missing
registry-sync audit --org mcp-tool-shop-org

# Generate an action plan
registry-sync plan --org mcp-tool-shop-org

# Execute the plan (creates GitHub issues + PRs)
registry-sync apply --confirm
```

## Commands

### `audit`

Scans all repos in a GitHub org, reads each repo's `package.json` and checks for `Dockerfile`, then queries npmjs and GHCR to build a presence matrix.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

Output shows drift status per registry:
- **✓** current — published version matches repo
- **⚠** behind — repo version is ahead of published
- **missing** — not yet published
- **○** orphan — published but no matching repo

### `plan`

Runs an audit and generates an action plan with risk levels.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Action types:
- **publish** — first-time publish to a registry
- **update** — version bump needed (repo ahead of published)
- **scaffold-workflow** — add CI publish workflow via PR
- **prune** — orphaned package needs cleanup

### `apply`

Executes the plan. All actions are non-destructive in v1:
- Creates GitHub **issues** for publish/update/prune actions
- Opens GitHub **PRs** with CI workflow files for scaffold actions

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

Without `--confirm`, shows a dry-run (same as `plan`).

## Configuration

Place `registry-sync.config.json` in your project root:

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

Falls back to sensible defaults if no config file is found.

## Authentication

Requires a GitHub token with `repo` scope:

1. `GITHUB_TOKEN` environment variable (preferred)
2. `gh auth token` fallback (if GitHub CLI is installed)

npm token is not required in v1 (read-only registry queries).

## Library Usage

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

## Security

See [SECURITY.md](./SECURITY.md) for the full security model and threat assessment.

- Tokens are never logged or cached to disk
- All apply actions create issues/PRs only (no direct publish)
- No telemetry, no analytics
- Connects only to `api.github.com` and `registry.npmjs.org`

---

Built by <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
