import type { DiffResult, DiffEntry, DriftChange } from '../types.js';

// --- Table (ANSI) ---

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

function pad(str: string, len: number): string {
  const stripped = str.replace(/\x1b\[[0-9;]*m/g, '');
  const diff = len - stripped.length;
  return diff > 0 ? str + ' '.repeat(diff) : str;
}

const changeColor: Record<DriftChange, string> = {
  new_drift: RED,
  worsened: RED,
  resolved: GREEN,
  new_repo: CYAN,
  removed_repo: DIM,
  unchanged: DIM,
};

const changeIcon: Record<DriftChange, string> = {
  new_drift: '⚠',
  worsened: '↑',
  resolved: '✓',
  new_repo: '+',
  removed_repo: '−',
  unchanged: '·',
};

export function formatDiffTable(result: DiffResult): string {
  const lines: string[] = [];

  lines.push(
    `${BOLD}Diff: ${result.org}${RESET}  ${DIM}${result.beforeDate} → ${result.afterDate}${RESET}`,
  );
  lines.push('');

  const interesting = result.entries.filter((e) => e.change !== 'unchanged');

  if (interesting.length === 0 && result.orphans.added.length === 0 && result.orphans.removed.length === 0) {
    lines.push(`${GREEN}✓ No changes detected.${RESET}`);
    return lines.join('\n');
  }

  if (interesting.length > 0) {
    const colW = { change: 14, repo: 28, registry: 12, details: 50 };
    lines.push(
      `${BOLD}${pad('Change', colW.change)} ${pad('Repository', colW.repo)} ${pad('Registry', colW.registry)} Details${RESET}`,
    );
    lines.push(
      `${DIM}${'─'.repeat(colW.change)} ${'─'.repeat(colW.repo)} ${'─'.repeat(colW.registry)} ${'─'.repeat(colW.details)}${RESET}`,
    );

    for (const entry of interesting) {
      const color = changeColor[entry.change];
      const icon = changeIcon[entry.change];
      const label = `${color}${icon} ${entry.change}${RESET}`;
      lines.push(
        `${pad(label, colW.change)} ${pad(entry.repo, colW.repo)} ${pad(entry.registry, colW.registry)} ${DIM}${entry.details}${RESET}`,
      );
    }
  }

  if (result.orphans.added.length > 0) {
    lines.push('');
    lines.push(`${YELLOW}New orphans:${RESET}`);
    for (const o of result.orphans.added) {
      lines.push(`  ${RED}+${RESET} ${o.registry}: ${o.packageName}`);
    }
  }
  if (result.orphans.removed.length > 0) {
    lines.push('');
    lines.push(`${GREEN}Resolved orphans:${RESET}`);
    for (const o of result.orphans.removed) {
      lines.push(`  ${GREEN}−${RESET} ${o.registry}: ${o.packageName}`);
    }
  }

  lines.push('');
  const s = result.summary;
  lines.push(
    `${RED}⚠ ${s.newDrift} new drift${RESET}  ${RED}${s.worsened} worsened${RESET}  ${GREEN}✓ ${s.resolved} resolved${RESET}  ${DIM}${s.unchanged} unchanged${RESET}`,
  );

  return lines.join('\n');
}

// --- JSON ---

export function formatDiffJson(result: DiffResult): string {
  return JSON.stringify(result, null, 2);
}

// --- Markdown ---

const changeMdIcon: Record<DriftChange, string> = {
  new_drift: '🔴',
  worsened: '🟠',
  resolved: '✅',
  new_repo: '🆕',
  removed_repo: '🗑️',
  unchanged: '·',
};

export function formatDiffMarkdown(result: DiffResult): string {
  const lines: string[] = [];

  lines.push(`# Diff: ${result.org}`);
  lines.push('');
  lines.push(`> ${result.beforeDate} → ${result.afterDate}`);
  lines.push('');

  const interesting = result.entries.filter((e) => e.change !== 'unchanged');

  if (interesting.length === 0 && result.orphans.added.length === 0 && result.orphans.removed.length === 0) {
    lines.push('> ✅ No changes detected.');
    return lines.join('\n');
  }

  if (interesting.length > 0) {
    lines.push('| Change | Repository | Registry | Details |');
    lines.push('|--------|------------|----------|---------|');

    for (const entry of interesting) {
      const icon = changeMdIcon[entry.change];
      lines.push(
        `| ${icon} ${entry.change} | ${entry.repo} | ${entry.registry} | ${entry.details} |`,
      );
    }
  }

  if (result.orphans.added.length > 0) {
    lines.push('');
    lines.push('## New Orphans');
    lines.push('');
    for (const o of result.orphans.added) {
      lines.push(`- 🔴 **${o.registry}**: \`${o.packageName}\``);
    }
  }

  if (result.orphans.removed.length > 0) {
    lines.push('');
    lines.push('## Resolved Orphans');
    lines.push('');
    for (const o of result.orphans.removed) {
      lines.push(`- ✅ **${o.registry}**: \`${o.packageName}\``);
    }
  }

  lines.push('');
  lines.push('## Summary');
  lines.push('');
  const s = result.summary;
  lines.push(
    `| Metric | Count |\n|--------|-------|\n| 🔴 New Drift | ${s.newDrift} |\n| 🟠 Worsened | ${s.worsened} |\n| ✅ Resolved | ${s.resolved} |\n| · Unchanged | ${s.unchanged} |\n| 🆕 New Repos | ${s.newRepos} |\n| 🗑️ Removed Repos | ${s.removedRepos} |\n| New Orphans | ${s.newOrphans} |\n| Resolved Orphans | ${s.removedOrphans} |`,
  );

  return lines.join('\n');
}
