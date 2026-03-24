# Brand Rules — @mcptoolshop/registry-sync

## Tone

Honest mutation reporter. The system creates GitHub issues and PRs to close registry drift. It reports what it did, what failed, and what's left — not what it hoped would happen.

## Domain language

| Term | Meaning | Must not be confused with |
|------|---------|--------------------------|
| Audit | Read-only comparison of org repos against registries | A "check" that changes anything |
| Plan | Deterministic action list derived from audit results | A "decision" or "recommendation" |
| Apply | Execute planned mutations via GitHub API | A "fix" or "resolution" (issues require human action) |
| Succeeded | Mutation was executed and GitHub returned a URL | "Drift is fixed" (human still has to act) |
| Failed | Mutation threw an error | Could be auth, permission, network, or validation |
| Skipped | Action type was 'skip' — no mutation needed | "Checked and clean" (not checked, just not drifted) |
| Issue | A GitHub issue requesting human action | A "fix" or "resolution" |
| Scaffold-workflow | Branch + file + PR creation (3 mutations in sequence) | A single atomic operation |

## Enforcement bans

### Language that must never appear in registry-sync output or docs

- "fixed" / "resolved" / "synced" after issue creation (creating an issue is a request, not a fix)
- "atomic" / "transactional" when describing apply (no rollback, no atomicity)
- "idempotent" without qualification (issue creation is not idempotent)
- "safely retried" without documenting what was retried and why
- "all actions completed" when any action failed (partial failure must be visible)

### Contamination risks

1. **Completion pretense** — framing issue creation as "drift fixed" when a human still has to merge/publish
2. **Atomicity pretense** — implying multi-step mutations (createWorkflowPR) are transactional when they're not
3. **Idempotency pretense** — implying re-runs are safe when they create duplicate issues
4. **Retry invisibility** — hiding 422 retry and fetchGitHub 3x retry from the caller
5. **Failure collapse** — mapping auth, permission, network, and validation failures to the same error code
