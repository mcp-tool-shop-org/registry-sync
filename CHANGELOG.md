# Changelog

## Unreleased

### Security
- vitest and @vitest/coverage-v8 3.2.7 → 5.0.1, clearing GHSA-82fw-gwwq-j7x9 (moderate, in @vitest/mocker, reached through both) that had turned CI's `npm audit --audit-level=moderate` step red. vite 8.3.0 now comes in as vitest's required peer. Dev dependencies only; the published package is unchanged.
- Still open, below the audit gate: GHSA-g7r4-m6w7-qqqr (low) in esbuild 0.27.3, which tsup's latest release pins at `^0.27.0`. It is a file read through esbuild's dev server on Windows, which nothing here starts.

### Tests
- Coverage floor moved to the new reading: vitest 4 and later also count the branches inside functions no test calls, so the unchanged code and its 206 tests read lines 74.81, branches 71.02, functions 85.49, statements 76.07 (vitest 3: 79.57, 90, 82.81, 79.57). The floor sits on those numbers with no slack, and `autoUpdate` keeps ratcheting from there.

## 1.1.1 (2026-03-25)

### Added
- 3 version alignment tests (semver, >= 1.0.0, CLI --version match)

### Fixed
- SHA-pinned CI actions for supply-chain safety

## 1.1.0 (2026-03-19)

### Added

- `diff` command — compare two audit snapshots to surface new drift, resolved drift, worsened drift, new/removed repos, and orphan changes
- `diff` formatters: table (ANSI), JSON, Markdown
- `diff()` function exported from library API with full TypeScript types (`DiffResult`, `DiffEntry`, `DriftChange`)
- `--before <file>` CLI flag for diff's baseline snapshot
- `ahead` drift status — detects when published version is ahead of repo version (rollback or hotfix scenarios)
- `ahead` handling in plan (skip with medium risk) and formatters (↓ symbol in table, ⬇️ in markdown)

### Fixed

- Semver comparison bug where `cmp === -1` (published ahead of repo) was silently treated as `current` instead of `ahead`
- GHCR provider now uses shared `fetchGitHubPaginated` with auth, retry, and throttle (was manual pagination bypassing all infrastructure)
- npm registry queries now use abbreviated metadata endpoint (`application/vnd.npm.install.v1+json`) reducing bandwidth
- Removed dead code: `listContainerPackages`, `hasPublishWorkflow`, unused `workflowProfiles` config field
- CLI version now reads dynamically from package.json instead of hardcoded string
- Error codes `INPUT_INVALID_FILE` and `INPUT_FILE_NOT_FOUND` added to `SyncErrorCode` union

### Tests

- 66 tests across 9 test files (up from ~30)
- New test suites: diff (11 tests), apply (8), config (4), errors (7), format (10), auth (2)

## 1.0.3 (2026-03-02)

### Added

- VS Code extension detection in plan — repos with `vscode-extension` topic, `-vscode` suffix, or `vscode-` prefix are auto-skipped from npm publish with `skipReason: 'suspected-vscode-extension'` and `suggestedTarget: 'vscode-marketplace'`
- `SkipReason` type exported from library API

## 1.0.2 (2026-03-02)

### Added

- `--concurrency <n>` flag for parallel GitHub API requests (1-20, default: 5)
- `--from <file>` flag to load audit results from file (avoids re-running audit)
- `--out <file>` / `-o` flag to write output to file instead of stdout
- `--limit <n>` flag for wave batching (apply at most N actions per run)
- `--type` alias for `--target`
- `--json` shorthand for `--format json`
- `AuditOptions` and `ApplyOptions` exported from library API

## 1.0.1 (2026-03-02)

### Added

- Shipcheck gates (A-D hard, E soft — all passing)
- Threat model in README
- CHANGELOG.md included in npm tarball
- Landing page (site-theme)
- Translations (8 languages)
- Brand logo

## 1.0.0 (2026-03-02)

### Added

- `audit` command — scans GitHub org repos, checks npmjs + GHCR presence, builds drift matrix
- `plan` command — generates action plan from audit (publish, update, scaffold-workflow, prune)
- `apply` command — executes plan via GitHub issues + PRs (requires `--confirm`)
- Output formats: table (ANSI), JSON, Markdown
- Config file support (`registry-sync.config.json`)
- GitHub token auto-detection (`GITHUB_TOKEN` env var or `gh auth token`)
- Workflow templates for Node lib, Node CLI, and container publish
- Zero production dependencies
