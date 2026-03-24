# Current Priorities — @mcptoolshop/registry-sync

## Status

Locked (Role OS lockdown 2026-03-24). Primary seam: write-path mutation truth.

## Classification

Lock candidate → locked.

## Seam family

Write-path / mutation truth — same family as any system where the outcome surface must distinguish between accept, commit, retry, partial failure, and duplicate suppression.

## Must-preserve invariants (8)

1. **Plan is read-only** — plan() never mutates remote state. Only apply() writes.
2. **Per-action success/failure** — every apply result includes per-action success boolean, URL (on success), and error (on failure). No aggregate-only reporting.
3. **Partial failure is visible** — if 3 of 5 actions succeed, the summary shows `succeeded: 3, failed: 2`. Failed actions include error messages.
4. **Apply continues past failure** — one failed action does not abort remaining actions. All planned actions are attempted.
5. **Structured error codes** — SyncError includes code, message, and hint. Auth errors are distinguishable from apply errors at the exit-code level.
6. **Exit code contract** — 0 = success, 1 = auth/input error, 2 = apply/API failure.
7. **No disk persistence in apply** — apply results are returned in-memory and formatted for output. No state file is written.
8. **Token resolution is fail-fast** — missing token throws AUTH_MISSING before any mutation is attempted.

## Banned detours

- Adding "auto-retry on failure" that hides retry count from the caller
- Adding "skip if already exists" without explicit idempotency checks (guessing is worse than duplicating)
- Adding rollback without full transaction semantics (partial rollback is worse than no rollback)
- Collapsing per-action results into aggregate-only output
- Framing issue creation as "drift resolved"
