# registry-sync Test Plan — Comprehensive Handoff Brief

**Current state:** 55 tests across 8 files. `tsc --noEmit` clean, `vitest run` green.
**Goal:** Full branch coverage for every module. Target: ~150+ tests.

All tests use vitest. Mock `globalThis.fetch` via `vi.stubGlobal('fetch', vi.fn())`.
Set `process.env.GITHUB_TOKEN = 'test-token'` in beforeEach for any module that touches auth.

> **Note:** The plan.test.ts fixture `config` still has `workflowProfiles: {}` which no longer exists on `SyncConfig`. Fix this first — remove the field from the test config.

---

## 1. `test/fetch.test.ts` — NEW (0 tests → ~28 tests)

This is the highest-value test file. `fetch.ts` contains retry logic, rate limiting, throttling, and pagination — all untested.

### `pLimit` (concurrency limiter)
- `pLimit(1)` runs tasks sequentially (task 2 starts after task 1 finishes)
- `pLimit(3)` runs up to 3 concurrent tasks
- Tasks that throw still release their slot (queue isn't deadlocked)
- Task return values are forwarded correctly

### `fetchGitHub`
- Returns parsed JSON on 200 OK
- Returns `null` on 404 (not an error)
- Throws `SyncError('GITHUB_RATE_LIMIT')` on 403 with `x-ratelimit-remaining: 0` header — verify error message contains the reset date from `x-ratelimit-reset` header
- Throws `SyncError('GITHUB_RATE_LIMIT')` with 'unknown' when `x-ratelimit-reset` header is absent
- Throws `SyncError('GITHUB_API')` on 403 when `x-ratelimit-remaining` is NOT '0' (non-rate-limit 403)
- Retries on 429 (up to 3 retries) then throws
- Retries on 500, 502, 503, 504 with exponential backoff
- Does NOT retry on 400, 401, 403 (non-retryable)
- Respects `retry-after` header — if `retry-after` header is present, delay is `max(backoff, retryAfter * 1000)`
- Throws on network error (fetch itself throws) after MAX_RETRIES
- Prepends `https://api.github.com` to relative paths
- Passes through absolute `https://` URLs unchanged
- Sends Authorization header with Bearer token
- Sends correct `X-GitHub-Api-Version` and Accept headers

### `fetchGitHubPaginated`
- Returns all items from a single page (no Link header)
- Follows `Link: <url>; rel="next"` header across 2+ pages, concatenating results
- Stops when no `rel="next"` link is present
- Throws `SyncError('GITHUB_API')` on non-OK response
- Works with absolute URL input
- Works with relative path input

### `fetchNpm`
- Returns parsed JSON on 200 OK
- Returns `null` on 404
- Retries on 429, 500, 502, 503, 504
- Does NOT retry on 400, 401
- Throws after MAX_RETRIES exhausted
- Throws on network error after retries
- Sends `Accept: application/vnd.npm.install.v1+json` header

### Testing notes
- Use `vi.useFakeTimers()` and `vi.advanceTimersByTimeAsync()` to avoid real delays in retry/throttle tests
- OR set `BASE_DELAY` to 0 by refactoring the module to accept options (preferred: just mock `setTimeout` or use fake timers)
- For throttle/acquireSlot tests, the internal `locks` Map and `SOURCE_DELAYS` are module-private. Test them indirectly through `fetchGitHub`/`fetchNpm` behavior, or accept that throttle is an implementation detail.

---

## 2. `test/audit.test.ts` — NEW (0 tests → ~22 tests)

The audit module orchestrates providers. Mock all 4 provider functions.

### Setup
```ts
vi.mock('../src/providers/github.js');
vi.mock('../src/providers/npm.js');
vi.mock('../src/providers/ghcr.js');
```

### Core audit flow
- Returns `AuditResult` with correct `org`, `generatedAt` (ISO string), `repoCount`
- Filters out archived repos from the result
- Filters out repos in `config.exclude` list
- Calls `readPackageJson` for each non-archived, non-excluded repo
- Calls `hasDockerfile` for each non-archived, non-excluded repo
- Sets `hasPackageJson: true` and populates `packageJsonName`/`packageJsonVersion`/`packageJsonPrivate` when package.json exists
- Sets `hasPackageJson: false` when `readPackageJson` returns null

### npm presence logic
- Skips npm check entirely when `config.targets.npm.enabled === false`
- Skips npm check for repos with `packageJsonPrivate: true`
- Skips npm check for repos with no `packageJsonName`
- Skips npm check for repos with no package.json
- Sets drift `'current'` when repo version === npm version (compareSemver returns 0)
- Sets drift `'behind'` when repo version > npm version (compareSemver returns 1)
- Sets drift `'ahead'` when repo version < npm version (compareSemver returns -1)
- Sets drift `'missing'` when npm returns null (not published)
- Uses `'0.0.0'` as fallback when `packageJsonVersion` is undefined

### Non-npm-candidate rows
- Adds row with `drift: 'private'` for repos where `packageJsonPrivate: true`
- Adds row with empty presence array for repos with no package.json (npm not applicable)
- Does NOT add duplicate rows for repos already in the npm-candidate list

### GHCR presence logic
- Skips GHCR check entirely when `config.targets.ghcr.enabled === false`
- Matches GHCR container to repo by name
- Matches GHCR container to repo by baseName (e.g., `claude-toolstack/gateway` matches repo `claude-toolstack`)
- Adds `drift: 'current'` with `published: true` for matched containers
- Adds orphan entry for containers with no matching repo
- Adds `drift: 'missing'` for repos with Dockerfile but no GHCR container
- Does NOT add GHCR missing for repos without Dockerfile

### Sorting
- Rows with `behind` or `missing` drift sort before rows without
- Within same actionability tier, sorts alphabetically by repo name

### Progress callback
- Calls `onProgress` with phase `'Listing repos'`
- Calls `onProgress` with phase `'Scanning repos'` during enrichment
- Calls `onProgress` with phase `'Checking npm'` during npm checks
- Calls `onProgress` with phase `'Checking GHCR'` during GHCR checks
- Works correctly when `onProgress` is `undefined` (no crash)

### Concurrency
- Uses `options.concurrency` when provided
- Defaults to 5 when `options.concurrency` is undefined

---

## 3. `test/apply.test.ts` — EXPAND (8 tests → ~20 tests)

### Existing (8 tests) — keep as-is

### `createWorkflowPR` path (scaffold-workflow) — NEW
- Calls `fetchGitHub` to get repo default branch
- Calls `fetchGitHub` to get HEAD ref sha
- Creates branch via POST `/git/refs` with correct sha
- Tolerates 422 on branch creation (branch already exists)
- Throws on non-422 branch creation failure
- Creates workflow file via PUT `/contents/.github/workflows/publish.yml` with base64-encoded content on the new branch
- Throws if workflow file creation fails
- Creates PR via POST `/pulls` with correct head/base branches
- Throws if PR creation fails
- Returns the PR `html_url`
- Generated workflow content contains `npm publish --access public --provenance`
- Generated workflow uses `ubuntu-latest` and `node-version: 22`

### `createIssue` edge cases — NEW
- 422 retry also fails → throws `SyncError('APPLY_FAILED')` with retry status
- Issue body for `publish` type contains "Steps to resolve" and `npm pack` instructions
- Issue body for `update` type contains fromVersion and toVersion
- Issue body for `prune` type contains "orphaned" language
- Issue body always contains registry-sync attribution link

### `executeAction` dispatch — NEW
- Returns `undefined` for unknown action types (the `default` case)
- Routes `scaffold-workflow` to `createWorkflowPR`

### Mixed success/failure
- Apply with 3 actions where 1st succeeds, 2nd fails, 3rd succeeds → `succeeded: 2, failed: 1`
- Failure on one action does NOT abort remaining actions

---

## 4. `test/providers/github.test.ts` — NEW (0 tests → ~14 tests)

Mock `fetchGitHub` and `fetchGitHubPaginated` from `../fetch.js`.

### `listOrgRepos`
- Filters out forked repos
- Maps GitHub API fields to `RepoInfo` shape correctly (snake_case → camelCase)
- Sets `topics` to empty array when `topics` field is undefined
- Sets `hasPackageJson: false` and `hasDockerfile: false` (enrichment happens in audit, not here)

### `readFileContent`
- Returns decoded base64 content when file exists
- Returns `null` when `fetchGitHub` returns null (404)
- Returns `null` when response `type` is not `'file'` (e.g., directory)
- Returns `null` when response has no `content` field

### `readPackageJson`
- Returns parsed JSON when package.json exists
- Returns `null` when file doesn't exist
- Returns `null` when file content is invalid JSON (catch branch)

### `hasDockerfile`
- Returns `true` when Dockerfile exists (fetchGitHub returns non-null)
- Returns `false` when Dockerfile doesn't exist (fetchGitHub returns null)

---

## 5. `test/providers/ghcr.test.ts` — NEW (0 tests → ~6 tests)

Mock `fetchGitHub` and `fetchGitHubPaginated` from `../fetch.js`.

### `listGhcrPackages`
- Returns mapped `ContainerPackage[]` from paginated response
- Returns empty array when `fetchGitHubPaginated` throws (catch branch — 403/404 from packages API)
- Correctly maps `package_type` → `packageType`, `created_at` → `createdAt`, etc.

### `getGhcrPackage`
- Returns `ContainerPackage` when package exists
- Returns `null` when package doesn't exist (fetchGitHub returns null)
- URL-encodes the package name

---

## 6. `test/providers/npm.test.ts` — EXPAND (3 tests → ~6 tests)

### New tests
- Returns empty string for `lastPublished` when `modified` field is absent
- Encodes scoped package names correctly (`@scope/name` → `%40scope%2Fname`)
- Encodes package names with special characters

---

## 7. `test/config.test.ts` — EXPAND (4 tests → ~10 tests)

### `loadConfig` — NEW
- Finds config file in parent directory (walks up from startDir)
- Merges partial config with defaults (e.g., config only specifies `org`, gets default `exclude` and `targets`)
- Overrides individual target flags (e.g., `{ targets: { npm: { enabled: false } } }` disables npm but ghcr stays true)
- Throws `SyncError('CONFIG_INVALID')` for malformed JSON
- Uses `process.cwd()` when `startDir` is not provided

### `findConfigUp` edge cases (tested indirectly through `loadConfig`)
- Stops at filesystem root without infinite loop

### Setup note
These tests need a temp directory with a `registry-sync.config.json` file. Use `fs.mkdtempSync` + `fs.writeFileSync` in beforeEach, clean up in afterEach.

---

## 8. `test/auth.test.ts` — REWRITE (2 tests → ~5 tests)

The current tests are weak — they test `process.env` directly instead of the actual `getGitHubToken()` function. The challenge is the module-level `cachedToken` variable.

### Approach
Use `vi.resetModules()` + dynamic `import()` in each test to get a fresh module without cached state.

### Tests
- Returns `GITHUB_TOKEN` from env
- Returns `GH_TOKEN` when `GITHUB_TOKEN` is not set
- Prefers `GITHUB_TOKEN` over `GH_TOKEN` when both are set
- Throws `SyncError('AUTH_MISSING')` when no env var and `gh auth token` fails
- Caches token on subsequent calls (second call doesn't re-read env)

---

## 9. `test/semver.test.ts` — KEEP (12 tests, complete)

Already well-covered. No additions needed.

---

## 10. `test/plan.test.ts` — MINOR FIX + EXPAND (9 tests → ~13 tests)

### Fix first
Remove `workflowProfiles: {}` from the test config object (field was removed from `SyncConfig`).

### New tests
- Generates skip for `excluded` drift status
- Generates skip for `private` drift status (with correct details text)
- Target filter `'ghcr'` excludes npm actions
- Target filter also applies to orphan prune actions
- Empty audit (0 rows, 0 orphans) → summary all zeros, empty actions array

---

## 11. `test/format.test.ts` — EXPAND (10 tests → ~18 tests)

### Table formatter — NEW
- `formatAuditTable` renders `private` drift as dim text
- `formatAuditTable` renders `ahead` drift with `↓` indicator
- `formatAuditTable` renders repos with no presence (no package.json, no docker) with `---`
- `formatAuditTable` summary line includes correct counts for current, behind, missing, orphans
- `formatPlanTable` with all risk levels shows correct colors (green/yellow/red)

### Markdown formatter — NEW
- `formatAuditMarkdown` summary table has correct column structure
- `formatPlanMarkdown` risk icons: high → 🔴, medium → 🟡, low → 🟢
- `formatAuditMarkdown` with no orphans does NOT include "Orphaned Packages" section

---

## 12. `test/errors.test.ts` — KEEP (7 tests, complete)

Already well-covered. No additions needed.

---

## 13. `test/cli.test.ts` — NEW (0 tests → ~18 tests)

Test `parseArgs` and `loadAuditFromFile` by extracting them or testing through the CLI entry point.

### Option: Extract `parseArgs` and `loadAuditFromFile` as named exports
Currently these are module-private. Either:
- (a) Export them for testing, or
- (b) Test the CLI end-to-end by spawning `node dist/cli.js` as a child process

Recommendation: **(a)** — export `parseArgs` and `loadAuditFromFile` for direct unit testing.

### `parseArgs`
- `['audit']` → `{ command: 'audit' }`
- `['audit', '--org', 'my-org']` → `{ command: 'audit', org: 'my-org' }`
- `['audit', '--format', 'json']` → `{ command: 'audit', format: 'json' }`
- `['audit', '-f', 'markdown']` → `{ command: 'audit', format: 'markdown' }`
- `['plan', '--target', 'npmjs']` → `{ command: 'plan', target: 'npmjs' }`
- `['plan', '--type', 'ghcr']` → alias works, `{ target: 'ghcr' }`
- `['plan', '-t', 'all']` → short alias works
- `['apply', '--confirm']` → `{ command: 'apply', confirm: true }`
- `['audit', '--json']` → shorthand, `{ format: 'json' }`
- `['audit', '--out', 'audit.json']` → `{ out: 'audit.json' }`
- `['-o', 'out.json', 'audit']` → flags before command still work
- `['--version']` → `{ command: 'version' }`
- `['-v']` → `{ command: 'version' }`
- `['--help']` → `{ command: 'help' }`
- `['-h']` → `{ command: 'help' }`
- `['--concurrency', '10']` → `{ concurrency: 10 }`
- `['--concurrency', '0']` → exits with error (< 1)
- `['--concurrency', '25']` → exits with error (> 20)
- `['--concurrency', 'abc']` → exits with error (NaN)
- `['--limit', '5']` → `{ limit: 5 }`
- `['--limit', '0']` → exits with error (< 1)
- `['--limit', '-3']` → exits with error (< 1)
- `['--from', 'audit.json']` → `{ from: 'audit.json' }`
- `['--include-archived']` → `{ includeArchived: true }`
- `['--no-skip']` → `{ noSkip: true }`
- `['audit', '--repo', 'my-tool']` → `{ repo: 'my-tool' }`
- `[]` (empty) → `{ command: '' }` (shows help)
- `['unknown-cmd']` → `{ command: 'unknown-cmd' }` (CLI handles the error)
- Unknown flags like `['audit', '--bogus']` are silently ignored

### `loadAuditFromFile`
- Loads and parses valid audit JSON file → returns `AuditResult`
- Throws `SyncError('INPUT_INVALID_FILE')` when file has valid JSON but missing `org` field
- Throws `SyncError('INPUT_INVALID_FILE')` when file has valid JSON but missing `rows` field
- Throws `SyncError('INPUT_FILE_NOT_FOUND')` when file doesn't exist
- Throws `SyncError('INPUT_FILE_NOT_FOUND')` when file contains invalid JSON

---

## Summary Table

| File | Current | Target | Delta | Priority |
|------|---------|--------|-------|----------|
| test/fetch.test.ts | 0 | ~28 | +28 | **P0** — retry/rate-limit/pagination is core infra |
| test/audit.test.ts | 0 | ~22 | +22 | **P0** — orchestration logic, drift classification |
| test/cli.test.ts | 0 | ~18 | +18 | **P1** — arg parsing + file loading |
| test/apply.test.ts | 8 | ~20 | +12 | **P1** — scaffold-workflow PR path untested |
| test/providers/github.test.ts | 0 | ~14 | +14 | **P1** — API response mapping |
| test/providers/ghcr.test.ts | 0 | ~6 | +6 | **P2** — small surface, catch branch |
| test/providers/npm.test.ts | 3 | ~6 | +3 | **P2** — encoding edge cases |
| test/config.test.ts | 4 | ~10 | +6 | **P2** — config merge + walk-up |
| test/auth.test.ts | 2 | ~5 | +3 | **P2** — needs rewrite for cache isolation |
| test/plan.test.ts | 9 | ~13 | +4 | **P2** — fix stale type + edge cases |
| test/format.test.ts | 10 | ~18 | +8 | **P3** — visual output, low risk |
| test/errors.test.ts | 7 | 7 | 0 | Done |
| test/semver.test.ts | 12 | 12 | 0 | Done |
| **Total** | **55** | **~159** | **+104** | |

## Execution order for the implementer

1. Fix `plan.test.ts` stale `workflowProfiles` field
2. `test/fetch.test.ts` (P0) — most impactful, unlocks confidence in all network code
3. `test/audit.test.ts` (P0) — unlocks confidence in the main pipeline
4. Export `parseArgs` + `loadAuditFromFile` from `cli.ts`, then write `test/cli.test.ts` (P1)
5. `test/apply.test.ts` expansion (P1) — scaffold-workflow path
6. `test/providers/github.test.ts` (P1)
7. P2 batch: ghcr, npm expansion, config expansion, auth rewrite
8. P3: format expansion
