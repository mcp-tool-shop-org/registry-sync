# Changelog

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
