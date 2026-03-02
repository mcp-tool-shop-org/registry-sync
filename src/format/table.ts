import type { AuditResult, PlanResult, RegistryPresence } from '../types.js';

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function pad(str: string, len: number): string {
  // Strip ANSI for length calculation
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = len - stripped.length;
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

function driftCell(p: RegistryPresence): string {
  if (!p.published) {
    if (p.drift === 'missing') return `${YELLOW}missing${RESET}`;
    if (p.drift === 'private') return `${DIM}private${RESET}`;
    return `${DIM}---${RESET}`;
  }
  const ver = p.publishedVersion || '?';
  if (p.drift === 'current') return `${GREEN}${ver} ✓${RESET}`;
  if (p.drift === 'behind') return `${YELLOW}${ver} ⚠${RESET}`;
  if (p.drift === 'orphan') return `${RED}${ver} ○${RESET}`;
  return ver;
}

export function formatAuditTable(result: AuditResult): string {
  const lines: string[] = [];

  lines.push(
    `${BOLD}Registry Audit: ${result.org}${RESET}  ${DIM}(${result.repoCount} repos, ${result.generatedAt})${RESET}`,
  );
  lines.push('');

  // Header
  const colW = { name: 28, type: 10, npm: 14, ghcr: 14 };
  lines.push(
    `${BOLD}${pad('Repository', colW.name)} ${pad('Type', colW.type)} ${pad('npmjs', colW.npm)} ${pad('GHCR', colW.ghcr)}${RESET}`,
  );
  lines.push(
    `${DIM}${'─'.repeat(colW.name)} ${'─'.repeat(colW.type)} ${'─'.repeat(colW.npm)} ${'─'.repeat(colW.ghcr)}${RESET}`,
  );

  for (const row of result.rows) {
    const npmP = row.presence.find((p) => p.registry === 'npmjs');
    const ghcrP = row.presence.find((p) => p.registry === 'ghcr');

    const type = [
      row.repo.hasPackageJson ? 'npm' : '',
      row.repo.hasDockerfile ? 'docker' : '',
    ]
      .filter(Boolean)
      .join('+') || `${DIM}---${RESET}`;

    lines.push(
      `${pad(row.repo.name, colW.name)} ${pad(type, colW.type)} ${pad(npmP ? driftCell(npmP) : `${DIM}---${RESET}`, colW.npm)} ${pad(ghcrP ? driftCell(ghcrP) : `${DIM}---${RESET}`, colW.ghcr)}`,
    );
  }

  // Orphans
  if (result.orphans.length > 0) {
    lines.push('');
    lines.push(`${YELLOW}Orphaned packages (no matching repo):${RESET}`);
    for (const orphan of result.orphans) {
      lines.push(`  ${RED}○${RESET} ${orphan.registry}: ${orphan.packageName}`);
    }
  }

  // Summary
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
  lines.push(
    `${GREEN}✓ ${current} current${RESET}  ${YELLOW}⚠ ${behind} behind${RESET}  ${YELLOW}${missing} missing${RESET}  ${RED}○ ${result.orphans.length} orphans${RESET}`,
  );

  return lines.join('\n');
}

export function formatPlanTable(result: PlanResult): string {
  const lines: string[] = [];

  lines.push(
    `${BOLD}Sync Plan: ${result.org}${RESET}  ${DIM}(${result.generatedAt})${RESET}`,
  );
  lines.push('');

  const actionable = result.actions.filter((a) => a.type !== 'skip');

  if (actionable.length === 0) {
    lines.push(`${GREEN}✓ Everything is in sync. No actions needed.${RESET}`);
    return lines.join('\n');
  }

  const colW = { action: 20, target: 8, repo: 28, details: 50 };
  lines.push(
    `${BOLD}${pad('Action', colW.action)} ${pad('Target', colW.target)} ${pad('Repository', colW.repo)} Details${RESET}`,
  );
  lines.push(
    `${DIM}${'─'.repeat(colW.action)} ${'─'.repeat(colW.target)} ${'─'.repeat(colW.repo)} ${'─'.repeat(colW.details)}${RESET}`,
  );

  const riskColor = { low: GREEN, medium: YELLOW, high: RED };

  for (const action of actionable) {
    const color = riskColor[action.risk];
    const typeLabel = `${color}${action.type}${RESET}`;
    lines.push(
      `${pad(typeLabel, colW.action)} ${pad(action.target, colW.target)} ${pad(action.repo, colW.repo)} ${DIM}${action.details}${RESET}`,
    );
  }

  lines.push('');
  const s = result.summary;
  lines.push(
    `${BOLD}Summary:${RESET} ${s.publish} publish, ${s.update} update, ${s.scaffold} scaffold, ${s.prune} prune, ${s.skip} skip`,
  );

  return lines.join('\n');
}
