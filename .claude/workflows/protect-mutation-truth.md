# Workflow: Protect Mutation Truth

**Repo:** @mcptoolshop/registry-sync
**Seam:** Write-path mutation truth — the boundary where the system reports what actually happened during apply(), including partial failure, retry, idempotency, and orphaned state.

## What this workflow protects

The contract that every mutation outcome is reported honestly: accepted, failed, retried, partially completed, or duplicated. The caller must always know what changed on the remote, what didn't, and why.

## Automatic reject criteria (9)

A proposed change MUST be rejected if it:

1. **Collapses per-action results into aggregate-only output** — removes individual success/failure/error from ApplyAction results, replacing with summary counts alone
2. **Hides retry behavior from the caller** — makes internal retries (fetchGitHub 3x, createIssue 422-retry) invisible in output or logging, so the caller can't distinguish first-try from retried success
3. **Introduces idempotency claims without dedup checks** — labels apply as "safe to re-run" or "idempotent" without adding actual duplicate detection (e.g., checking for existing issues before creating)
4. **Obscures orphaned remote state** — fails to surface that a multi-step mutation (createWorkflowPR) left partial state (branch created, file not committed, PR not created) when a middle step fails
5. **Collapses distinct failure causes into one error code** — maps auth failure, permission denial, network error, rate limit, and validation failure to the same SyncError code without distinguishing them
6. **Frames issue creation as drift resolution** — uses language like "fixed," "resolved," or "synced" when the mutation was creating a GitHub issue that requires human action
7. **Adds rollback without transaction semantics** — introduces partial cleanup (e.g., delete branch on file failure) without guaranteeing atomicity, creating a new partial-state failure mode
8. **Changes the plan→apply boundary** — allows apply() to modify the plan, skip planned actions based on runtime heuristics, or add unplanned actions without the caller's knowledge
9. **Makes human-facing reassurance stronger while leaving machine-facing semantics unchanged** — e.g., console says "sync complete" while results show failed actions (org-wide reassurance drift rule)

## The key question this workflow answers

**When apply() reports its results, does the caller know exactly what changed on the remote, what didn't change, and why?**

### Must report honestly
- Per-action: success (with URL), failure (with error message and hint)
- Summary: succeeded/failed/skipped counts matching per-action results
- For multi-step mutations: which steps completed before failure
- For retries: that a retry occurred and what triggered it

### Must never imply
- That "succeeded" means "drift is fixed" (issues still need human action)
- That apply is idempotent (re-run creates duplicate issues)
- That multi-step mutations are atomic (branch can exist without file or PR)
- That 422 means one specific thing (it means "Validation Failed" — many possible causes)
- That all failures are the same kind of failure (auth ≠ permission ≠ network ≠ validation)

## When to re-prove

Re-prove this workflow when:
- New action types are added to apply
- Retry logic changes in fetchGitHub or createIssue
- Multi-step mutation sequences change (createWorkflowPR)
- Error classification changes
- Idempotency checks are added
- Any form of rollback is introduced
