# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.x     | Yes       |

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly:

1. **Do not** open a public GitHub issue
2. Email: 64996768+mcp-tool-shop@users.noreply.github.com
3. Include: description, reproduction steps, impact assessment
4. Expected response: within 72 hours

## Security Model

### Authentication
- Requires `GITHUB_TOKEN` with repo read access for audit
- Requires repo write access for apply (issues/PRs)
- Tokens are never logged, cached to disk, or transmitted to third parties
- Falls back to `gh auth token` (local CLI only)

### Network
- Connects to: `api.github.com`, `registry.npmjs.org`
- No telemetry, no analytics, no phone-home
- All connections use HTTPS

### Data
- No secrets stored on disk
- Config files contain org name and exclusion lists only
- Audit results may contain repo names and version numbers (public data)

### Apply Safety
- All apply actions are non-destructive (creates issues and PRs only)
- Requires explicit `--confirm` flag
- No direct npm publish or container push in v1

## Threat Model

| Threat | Mitigation |
|--------|------------|
| Token exposure in logs | Tokens never logged; only used in Authorization headers |
| Malicious config injection | Config is local JSON only; no remote config loading |
| Rate limit exhaustion | Per-source throttling; respects GitHub rate limit headers |
| Unauthorized repo modifications | Apply creates issues/PRs only; requires write-scoped token |
