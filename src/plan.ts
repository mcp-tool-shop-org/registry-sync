import type {
  AuditResult,
  AuditRow,
  SyncConfig,
  PlanResult,
  PlannedAction,
  RegistryTarget,
} from './types.js';

/**
 * Detects if a repo is a VS Code extension (should not be published to npm).
 * Rules:
 *  - topics include 'vscode-extension' (high confidence)
 *  - repo name ends with '-vscode'
 *  - package name ends with '-vscode' or starts with 'vscode-'
 */
function isSuspectedVscodeExtension(row: AuditRow): boolean {
  const topics = row.repo.topics.map((t) => t.toLowerCase());
  if (topics.includes('vscode-extension')) return true;

  const repoName = row.repo.name.toLowerCase();
  if (repoName.endsWith('-vscode')) return true;

  const pkgName = (row.repo.packageJsonName || '').toLowerCase();
  if (pkgName.endsWith('-vscode') || pkgName.startsWith('vscode-')) return true;

  return false;
}

export function plan(
  auditResult: AuditResult,
  config: SyncConfig,
  targetFilter?: RegistryTarget | 'all',
): PlanResult {
  const actions: PlannedAction[] = [];
  const filter = targetFilter || 'all';

  for (const row of auditResult.rows) {
    for (const presence of row.presence) {
      // Apply target filter
      if (filter !== 'all' && presence.registry !== filter) continue;

      switch (presence.drift) {
        case 'behind':
          actions.push({
            type: 'update',
            target: presence.registry,
            repo: row.repo.name,
            fromVersion: presence.publishedVersion,
            toVersion: row.repo.packageJsonVersion,
            details: `Published ${presence.publishedVersion} < repo ${row.repo.packageJsonVersion}`,
            risk: 'low',
          });
          break;

        case 'missing':
          if (presence.registry === 'npmjs') {
            // Check if this is a VS Code extension — skip npm publish
            if (isSuspectedVscodeExtension(row)) {
              actions.push({
                type: 'skip',
                target: presence.registry,
                repo: row.repo.name,
                details: 'Suspected VS Code extension — not an npm publish target',
                risk: 'low',
                skipReason: 'suspected-vscode-extension',
                suggestedTarget: 'vscode-marketplace',
              });
            } else {
              actions.push({
                type: 'publish',
                target: presence.registry,
                repo: row.repo.name,
                toVersion: row.repo.packageJsonVersion,
                details: `Not yet published to npmjs (repo has v${row.repo.packageJsonVersion || 'unknown'})`,
                risk: 'medium',
              });
            }
          } else if (presence.registry === 'ghcr') {
            actions.push({
              type: 'scaffold-workflow',
              target: presence.registry,
              repo: row.repo.name,
              details: 'Dockerfile exists but no GHCR image published',
              risk: 'medium',
            });
          }
          break;

        case 'ahead':
          actions.push({
            type: 'skip',
            target: presence.registry,
            repo: row.repo.name,
            details: `Published ${presence.publishedVersion} > repo ${row.repo.packageJsonVersion ?? 'unknown'} (rollback or hotfix?)`,
            risk: 'medium',
            skipReason: 'ahead',
          });
          break;

        case 'current':
        case 'private':
        case 'excluded':
          actions.push({
            type: 'skip',
            target: presence.registry,
            repo: row.repo.name,
            details:
              presence.drift === 'current'
                ? `Up to date (${presence.publishedVersion})`
                : `Skipped (${presence.drift})`,
            risk: 'low',
            skipReason: presence.drift,
          });
          break;
      }
    }
  }

  // Add orphan prune actions
  for (const orphan of auditResult.orphans) {
    if (filter !== 'all' && orphan.registry !== filter) continue;
    actions.push({
      type: 'prune',
      target: orphan.registry,
      repo: orphan.packageName,
      details: `Orphaned ${orphan.registry} package — no matching repo found`,
      risk: 'high',
    });
  }

  // Sort: actionable first (publish > update > scaffold > prune > skip)
  const typeOrder: Record<string, number> = {
    publish: 0,
    update: 1,
    'scaffold-workflow': 2,
    prune: 3,
    skip: 4,
  };
  actions.sort((a, b) => (typeOrder[a.type] ?? 5) - (typeOrder[b.type] ?? 5));

  const summary = {
    publish: actions.filter((a) => a.type === 'publish').length,
    update: actions.filter((a) => a.type === 'update').length,
    scaffold: actions.filter((a) => a.type === 'scaffold-workflow').length,
    prune: actions.filter((a) => a.type === 'prune').length,
    skip: actions.filter((a) => a.type === 'skip').length,
  };

  return {
    org: auditResult.org,
    generatedAt: new Date().toISOString(),
    actions,
    summary,
  };
}
