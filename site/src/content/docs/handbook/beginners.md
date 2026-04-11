---
title: For Beginners
description: New to registry-sync? Start here for a gentle introduction.
sidebar:
  order: 99
---

## What Is This Tool?

registry-sync is a CLI tool that audits your GitHub organization's package publishing status. It checks whether each repo is published to npm and/or GHCR (GitHub Container Registry), detects version drift between your source code and what's actually published, finds orphaned packages, and generates action plans to fix inconsistencies.

Think of it like Terraform, but for package registries. You define what should be published, and registry-sync tells you what's out of sync and how to fix it.

## Who Is This For?

- **Open-source maintainers** managing multiple packages across registries
- **DevOps engineers** who need to audit publication status across an org
- **Teams** with many repositories that publish to npm and/or Docker registries
- **Anyone** who has lost track of which packages are published, which are outdated, and which have drifted

## Prerequisites

1. **Node.js 18+** — Check with `node --version`
2. **GitHub personal access token** — With `read:org` and `read:packages` scopes. Set as `GITHUB_TOKEN` environment variable
3. **Basic terminal skills** — You'll run CLI commands

No npm credentials needed for auditing (read-only). Write operations (apply) need appropriate registry tokens.

## Your First 5 Minutes

**Minute 1: Install**
```bash
npm install -g @mcptoolshop/registry-sync
```

**Minute 2: Set your GitHub token**
```bash
export GITHUB_TOKEN=ghp_your_token_here
```

**Minute 3: Audit your org**
```bash
registry-sync audit --org your-org-name
```
This scans all repos, checks npm and GHCR, and shows a table of publication status.

**Minute 4: Generate a plan**
```bash
registry-sync plan --org your-org-name
```
This produces an action plan showing what needs to be published, updated, or cleaned up.

**Minute 5: Review the output**
The plan shows actions like "publish v1.2.3 to npm" or "version drift: source is 1.3.0 but npm has 1.2.0". Review before applying.

## Common Mistakes

1. **Missing GITHUB_TOKEN** — The tool needs a GitHub token to read org repos and check registries. Without it, all API calls fail
2. **Token without sufficient scopes** — Your token needs `read:org` and `read:packages` at minimum. Public repos may work with fewer scopes, but private repos need these
3. **Running `apply` without reviewing the plan** — Always run `plan` first and review the output before `apply`. The apply command creates GitHub issues and PRs
4. **Expecting write access to npm** — Auditing is read-only. Actually publishing packages (`apply`) requires npm credentials configured separately
5. **Auditing very large orgs** — For orgs with hundreds of repos, the audit may take several minutes due to rate limits. The tool handles pagination automatically

## Next Steps

- Follow the full [Getting Started](../getting-started/) guide
- See all [Commands](../commands/) for audit, plan, and apply options
- Review [Configuration](../configuration/) for customizing behavior
- Read about [Security](../security/) and token handling

## Glossary

- **Audit** — A read-only scan that builds a presence matrix of your org's repos across registries (npm, GHCR)
- **Drift** — When the version in a repo's `package.json` differs from what's published to a registry
- **Orphan** — A package published to a registry that no longer has a corresponding repo in the org
- **Action plan** — A list of steps to bring registries in sync with source code (publish, update, deprecate)
- **GHCR** — GitHub Container Registry, where Docker images are stored
- **Presence matrix** — A table showing which repos are published to which registries, with version status
- **Desired state** — The publication status that should exist based on your repo configurations. registry-sync compares actual state against desired state
- **Apply** — Execute an action plan by creating GitHub issues and PRs for each drift or missing publication
