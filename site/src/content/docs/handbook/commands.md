---
title: Commands
description: Detailed reference for the audit, plan, diff, and apply commands in registry-sync.
sidebar:
  order: 2
---

registry-sync provides four commands that form a progressive workflow: **audit** to observe, **plan** to decide, **diff** to compare, and **apply** to act.

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
| **↓** | Ahead | Published version is ahead of repo (rollback or hotfix) |
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

## diff

Compares two previously-saved audit snapshots to surface what changed between runs. No new API calls are made — the diff is pure computation over the two JSON files.

```bash
registry-sync diff --before audit-old.json --from audit-new.json [--format table|json|markdown]
```

### Change types

| Change | Meaning |
|--------|---------|
| **new_drift** | Repo was current, now behind/missing/ahead |
| **resolved** | Drift was present, now current |
| **worsened** | Drift deepened (e.g. behind → missing) |
| **new_repo** | Repo appeared in the newer snapshot |
| **removed_repo** | Repo disappeared from the newer snapshot |

The diff also tracks orphan changes (new and resolved orphaned packages).

### Workflow

```bash
# Save a baseline audit
registry-sync audit --json -o baseline.json

# ... time passes, repos change ...

# Save a new audit
registry-sync audit --json -o current.json

# See what changed
registry-sync diff --before baseline.json --from current.json
```

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
