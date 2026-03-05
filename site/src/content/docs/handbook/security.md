---
title: Security
description: Security model, permissions, and threat boundaries for registry-sync.
sidebar:
  order: 4
---

registry-sync is designed with a minimal-access, non-destructive security model. This page documents what it touches, what it does not, and what permissions it requires.

## What it touches

- **Public GitHub API** — reads repository metadata, file contents (`package.json`, `Dockerfile`), and org membership. When `apply --confirm` is used, creates issues and pull requests on repos you have write access to.
- **Public npm registry** — read-only queries for package metadata (version numbers, publish dates). No authentication required for these lookups.

## What it does NOT touch

- **No local file modification** — registry-sync reads your config file but never writes to your filesystem.
- **No npm publish** — it does not run `npm publish` or push packages on your behalf.
- **No Docker push** — it does not push container images to GHCR or any other registry.
- **No credential storage** — tokens are read from environment variables or the GitHub CLI at runtime. Nothing is cached or persisted to disk.
- **No network egress beyond GitHub and npm** — registry-sync only communicates with `api.github.com` and `registry.npmjs.org`. No other endpoints are contacted.

## Telemetry

**None.** No analytics, no phone-home, no data collection of any kind. Zero telemetry by design.

## Permissions required

| Credential | Scope | Used by |
|-----------|-------|---------|
| `GITHUB_TOKEN` | `repo` (read) | `audit`, `plan` — read org repos, file contents |
| `GITHUB_TOKEN` | `repo` (write) | `apply --confirm` — create issues and PRs |
| npm token | Not required | All npm queries are public read-only |

### Token sources

1. **`GITHUB_TOKEN` environment variable** — preferred method
2. **`gh auth token` fallback** — if the GitHub CLI is installed and authenticated

## Non-destructive by design

The `apply` command in v1 only creates GitHub issues and pull requests. It never directly publishes packages, pushes containers, or deletes anything. The `--confirm` flag is required to take any action at all; without it, `apply` behaves identically to `plan` (dry-run).
