# Changelog

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
