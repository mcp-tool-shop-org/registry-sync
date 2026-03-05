---
title: Commands
description: Detailed reference for the audit, plan, and apply commands in registry-sync.
sidebar:
  order: 2
---

registry-sync provides three commands that form a progressive workflow: **audit** to observe, **plan** to decide, and **apply** to act.

## audit

Scans all repositories in a GitHub org, reads each repo's `package.json` and checks for `Dockerfile`, then queries the npmjs and GHCR registries to build a full presence matrix.

```bash
registry-sync audit [--org <org>] [--format table|json|markdown]
```

### Status symbols

The audit output uses these symbols to show drift status per registry:

| Symbol | Meaning | Description |
|--------|---------|-------------|
| **✓** | Current | Published version matches the repo version |
| **⚠** | Behind | Repo version is ahead of the published version |
| — | Missing | Not yet published to this registry |
| **○** | Orphan | Published package with no matching repo |

### Output formats

- **table** (default) — human-readable terminal output
- **json** — machine-readable for piping to other tools
- **markdown** — ready to paste into issues or docs

## plan

Runs an audit internally, then generates a risk-rated action plan describing what needs to change.

```bash
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

### Action types

| Action | Description | Risk |
|--------|-------------|------|
| **publish** | First-time publish to a registry | Low |
| **update** | Version bump needed — repo is ahead of published | Medium |
| **scaffold-workflow** | Add a CI publish workflow via PR | Low |
| **prune** | Orphaned package needs cleanup | High |

Actions are sorted by risk level so you can review the most impactful changes first.

## apply

Executes the plan. All actions in v1 are **non-destructive**:

- Creates GitHub **issues** for publish, update, and prune actions
- Opens GitHub **PRs** with CI workflow files for scaffold actions

```bash
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

### Dry-run mode

Without `--confirm`, `apply` shows a dry-run — identical output to `plan`. Nothing is created or modified until you pass `--confirm` explicitly.

```bash
# Preview what would happen (no changes made)
registry-sync apply

# Execute for real
registry-sync apply --confirm
```

### Target filtering

Use `--target` to limit actions to a specific registry:

```bash
# Only npm-related actions
registry-sync apply --confirm --target npmjs

# Only GHCR-related actions
registry-sync apply --confirm --target ghcr
```
