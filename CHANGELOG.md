# Changelog

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
