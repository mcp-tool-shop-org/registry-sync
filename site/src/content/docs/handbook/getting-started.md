---
title: Getting Started
description: Install registry-sync, set up authentication, and run your first audit-plan-apply workflow.
sidebar:
  order: 1
---

Get up and running with registry-sync in under five minutes.

## Install

Install globally:

```bash
npm install -g @mcptoolshop/registry-sync
```

Or run directly without installing:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## Authentication

registry-sync needs a GitHub token with `repo` scope to read org metadata and (for `apply`) create issues and PRs.

**Option 1 — Environment variable (preferred):**

```bash
export GITHUB_TOKEN=ghp_...
```

**Option 2 — GitHub CLI fallback:**

If you have the [GitHub CLI](https://cli.github.com/) installed and authenticated, registry-sync will automatically use `gh auth token` as a fallback. No extra configuration needed.

An npm token is **not** required in v1 — all registry queries are read-only against the public npm API.

## Quick start: audit, plan, apply

The core workflow follows three steps:

```bash
# 1. Audit — see what's published, what's drifted, what's missing
registry-sync audit --org mcp-tool-shop-org

# 2. Plan — generate a risk-rated action plan
registry-sync plan --org mcp-tool-shop-org

# 3. Apply — execute the plan (dry-run by default)
registry-sync apply

# 4. Apply for real — creates GitHub issues + PRs
registry-sync apply --confirm
```

Without `--confirm`, the `apply` command shows a dry-run identical to `plan` output. Nothing is created or modified until you explicitly confirm.

## Next steps

- [Commands](/registry-sync/handbook/commands/) — full reference for all three commands
- [Configuration](/registry-sync/handbook/configuration/) — customize behavior with a config file
- [Security](/registry-sync/handbook/security/) — understand what registry-sync does and does not touch
