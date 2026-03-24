# Repo Map — @mcptoolshop/registry-sync

## Stack

- TypeScript (Node.js), minimal dependencies
- ~15 source modules across src/ + src/providers/ + src/format/
- Vitest test runner
- Single entry: CLI (`dist/cli.js`)

## Module architecture

| Layer | Modules | Purpose | Mutates? |
|-------|---------|---------|----------|
| CLI | `cli.ts` | Command routing (audit, plan, apply, diff), arg parsing, output | No (orchestration) |
| Audit | `audit.ts`, `providers/*.ts` | Query GitHub org + npm/GHCR for presence + version drift | No (read-only) |
| Plan | `plan.ts` | Generate deterministic action list from audit result | No (pure function) |
| Apply | `apply.ts` | Execute mutations via GitHub API | **YES — creates issues, branches, files, PRs** |
| Auth | `auth.ts` | Token resolution (env var or `gh auth token`) | No |
| Fetch | `fetch.ts` | GitHub API client with retry (3x exponential backoff on 5xx) | No (but retries are invisible) |
| Format | `format/*.ts` | JSON/table/markdown output formatting | No |
| Types | `types.ts`, `errors.ts`, `config.ts` | Shared types, structured errors, config | No |

## Primary seam: Write-path mutation truth

### The apply() pipeline

```
apply(planResult, config)
  for each action in plan (excluding 'skip'):
    try:
      executeAction(action)
        → 'publish'/'update'/'prune': createIssue()
        → 'scaffold-workflow': createWorkflowPR()
      results.push({ success: true, url })
    catch:
      results.push({ success: false, error })
  return { results, summary: { succeeded, failed, skipped } }
```

### createIssue() — single mutation with 422 retry

```
POST /repos/{org}/{repo}/issues (with labels)
  → 201: return html_url
  → 422: retry WITHOUT labels (assumes label doesn't exist)
    → retry 201: return html_url
    → retry fail: throw APPLY_FAILED
  → other: throw APPLY_FAILED
```

**Truth concern:** 422 means "Validation Failed" — could be any validation error, not just missing labels. Retry is based on an assumption about the failure cause.

### createWorkflowPR() — three sequential mutations, no rollback

```
Step 1: POST /repos/{org}/{repo}/git/refs (create branch)
  → 422: tolerated (assumes branch already exists)
  → other fail: throw APPLY_FAILED

Step 2: PUT /repos/{org}/{repo}/contents/.github/workflows/publish.yml
  → fail: throw APPLY_FAILED (branch now orphaned on remote)

Step 3: POST /repos/{org}/{repo}/pulls
  → fail: throw APPLY_FAILED (branch + file exist, no PR)
```

**Truth concern:** If step 1 succeeds and step 2 fails, orphaned branch exists on remote. System reports failure but doesn't surface the orphaned state.

### Four liar-paths identified

| Path | Location | Risk |
|------|----------|------|
| Silent partial mutation | apply.ts createWorkflowPR | **HIGH** — orphaned branch invisible after step-2 failure |
| Duplicate issue creation | apply.ts createIssue | **HIGH** — no idempotency check, re-run creates duplicates |
| 422 retry assumption | apply.ts:112-134 | **MEDIUM** — assumes 422 = missing label, could be anything |
| Auth/permission indistinguishable | apply.ts catch blocks | **MEDIUM** — all failures map to APPLY_FAILED |

### Test gaps

- No auth.test.ts, fetch.test.ts, format.test.ts, diff.test.ts
- No idempotency test (apply twice with same plan)
- No partial-failure state test (branch exists, file doesn't)
- No retry behavior test in fetch.ts

## Validation

- `npm test` — Vitest
- `npm run build` — TypeScript compilation
