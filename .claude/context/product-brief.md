# Product Brief — @mcptoolshop/registry-sync

## What this is

Desired-state sync engine for multi-registry publishing. Audits org repos against npm/GHCR registries, plans actions to close drift (publish, update, prune, scaffold workflow), and applies those actions via GitHub API mutations (issue creation, branch creation, file commits, PR creation). Three-phase pipeline: audit → plan → apply.

## Type

CLI (three commands: audit, plan, apply, plus diff for comparison)

## Core value

Structured plan-then-apply separation. The plan is deterministic and read-only. Apply executes mutations against GitHub API with progress reporting and per-action success/failure tracking.

## What it is not

- Not a CI/CD pipeline — it creates issues and PRs, it does not publish packages itself
- Not a transaction system — apply has no rollback, no atomicity guarantees
- Not idempotent — running apply twice with the same plan creates duplicate GitHub issues
- Not a state validator — apply reports what it did, not whether desired state was achieved

## Anti-thesis (7 statements)

1. Must never report "success" when a mutation didn't actually complete — partial failure must be visible per-action, not collapsed into aggregate counts
2. Must never let retry silently double-write — if a 422 retry succeeds, the output must distinguish first-try from retried success
3. Must never leave orphaned remote state invisible — if branch creation succeeds but file commit fails, the orphaned branch must be surfaced
4. Must never collapse distinct failure causes into one error code — auth failure, permission failure, network failure, and validation failure are different things
5. Must never imply idempotency it doesn't have — running apply twice creates duplicate issues, and docs/output must not suggest otherwise
6. Must never frame issue creation as "mutation applied" when the actual state change requires human action — creating an issue is a request, not a fix
7. Must never hide retry behavior from the caller — internal retries (fetchGitHub 3x, createIssue 422-retry) must be observable, not invisible

## Highest-risk seam

**Write-path mutation truth** — the boundary where the system claims what happened during apply(). The liar-paths are: silent partial mutation (branch created but file failed), duplicate issue creation (no idempotency), retry collapse (422 assumed to mean one thing when it means many), and auth/permission failure indistinguishable from other failures.
