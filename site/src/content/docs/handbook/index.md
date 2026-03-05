---
title: registry-sync Handbook
description: Complete guide to registry-sync — the desired-state sync engine for multi-registry publishing.
sidebar:
  order: 0
---

Welcome to the **registry-sync** handbook.

registry-sync is a desired-state sync engine for multi-registry package publishing. Think of it as Terraform for package registries — audit your GitHub org against npmjs and GHCR, detect version drift, find orphaned packages, and generate action plans to close the gap.

It is the write-side companion to [registry-stats](https://github.com/mcp-tool-shop-org/registry-stats), which handles the read side (download counts and metrics).

## How it works

1. **Audit** — scan your org and build a presence matrix across registries
2. **Plan** — compute what needs to change, with risk-rated actions
3. **Apply** — execute the plan non-destructively via GitHub issues and PRs

## Handbook contents

- [Getting Started](/registry-sync/handbook/getting-started/) — install, authenticate, and run your first audit
- [Commands](/registry-sync/handbook/commands/) — detailed reference for `audit`, `plan`, and `apply`
- [Configuration](/registry-sync/handbook/configuration/) — config file format and library usage
- [Security](/registry-sync/handbook/security/) — security model, permissions, and threat boundaries

---

[Back to landing page](/registry-sync/)
