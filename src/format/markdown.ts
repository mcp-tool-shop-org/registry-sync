import type { AuditResult, PlanResult, RegistryPresence } from '../types.js';

function driftMd(p: RegistryPresence): string {
  if (!p.published) {
    if (p.drift === 'missing') return '**missing**';
    if (p.drift === 'private') return '_private_';
    return '---';
  }
  const ver = p.publishedVersion || '?';
  if (p.drift === 'current') return `${ver} ✅`;
  if (p.drift === 'behind') return `${ver} ⚠️`;
  if (p.drift === 'ahead') return `${ver} ⬇️`;
  if (p.drift === 'orphan') return `${ver} 🔴`;
  return ver;
}

export function formatAuditMarkdown(result: AuditResult): string {
  const lines: string[] = [];

  lines.push(`# Registry Audit: ${result.org}`);
  lines.push('');
  lines.push(
    `> ${result.repoCount} repos scanned at ${result.generatedAt}`,
  );
  lines.push('');

  lines.push('| Repository | Type | npmjs | GHCR |');
  lines.push('|------------|------|-------|------|');

  for (const row of result.rows) {
    const npmP = row.presence.find((p) => p.registry === 'npmjs');
    const ghcrP = row.presence.find((p) => p.registry === 'ghcr');

    const type = [
      row.repo.hasPackageJson ? 'npm' : '',
      row.repo.hasDockerfile ? 'docker' : '',
    ]
      .filter(Boolean)
      .join('+') || '---';

    lines.push(
      `| ${row.repo.name} | ${type} | ${npmP ? driftMd(npmP) : '---'} | ${ghcrP ? driftMd(ghcrP) : '---'} |`,
    );
  }

  if (result.orphans.length > 0) {
    lines.push('');
    lines.push('## Orphaned Packages');
    lines.push('');
    for (const orphan of result.orphans) {
      lines.push(`- 🔴 **${orphan.registry}**: \`${orphan.packageName}\``);
    }
  }

  const current = result.rows.filter((r) =>
    r.presence.every((p) => p.drift === 'current' || p.drift === 'private'),
  ).length;
  const behind = result.rows.filter((r) =>
    r.presence.some((p) => p.drift === 'behind'),
  ).length;
  const missing = result.rows.filter((r) =>
    r.presence.some((p) => p.drift === 'missing'),
  ).length;

  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push(
    `| Status | Count |\n|--------|-------|\n| ✅ Current | ${current} |\n| ⚠️ Behind | ${behind} |\n| Missing | ${missing} |\n| 🔴 Orphans | ${result.orphans.length} |`,
  );

  return lines.join('\n');
}

export function formatPlanMarkdown(result: PlanResult): string {
  const lines: string[] = [];

  lines.push(`# Sync Plan: ${result.org}`);
  lines.push('');

  const actionable = result.actions.filter((a) => a.type !== 'skip');

  if (actionable.length === 0) {
    lines.push('> ✅ Everything is in sync. No actions needed.');
    return lines.join('\n');
  }

  lines.push('| Action | Target | Repository | Risk | Details |');
  lines.push('|--------|--------|------------|------|---------|');

  for (const action of actionable) {
    const riskIcon = action.risk === 'high' ? '🔴' : action.risk === 'medium' ? '🟡' : '🟢';
    lines.push(
      `| ${action.type} | ${action.target} | ${action.repo} | ${riskIcon} ${action.risk} | ${action.details} |`,
    );
  }

  lines.push('');
  const s = result.summary;
  lines.push(
    `**Summary:** ${s.publish} publish, ${s.update} update, ${s.scaffold} scaffold, ${s.prune} prune, ${s.skip} skip`,
  );

  return lines.join('\n');
}
