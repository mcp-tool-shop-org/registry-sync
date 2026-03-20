import type {
  AuditResult,
  AuditRow,
  RegistryPresence,
  DiffResult,
  DiffEntry,
  DriftChange,
  DriftStatus,
  RegistryTarget,
  OrphanEntry,
} from './types.js';

const ACTIONABLE: Set<DriftStatus> = new Set(['behind', 'missing', 'ahead']);

function classifyChange(
  before: DriftStatus | undefined,
  after: DriftStatus | undefined,
): DriftChange {
  if (!before && after) return 'new_repo';
  if (before && !after) return 'removed_repo';
  if (before === after) return 'unchanged';

  const wasBad = ACTIONABLE.has(before!);
  const isBad = ACTIONABLE.has(after!);

  if (!wasBad && isBad) return 'new_drift';
  if (wasBad && !isBad) return 'resolved';
  if (wasBad && isBad && before !== after) return 'worsened';

  return 'unchanged';
}

function findPresence(
  row: AuditRow,
  registry: RegistryTarget,
): RegistryPresence | undefined {
  return row.presence.find((p) => p.registry === registry);
}

function describeChange(
  change: DriftChange,
  repo: string,
  registry: RegistryTarget,
  beforeP?: RegistryPresence,
  afterP?: RegistryPresence,
): string {
  const bVer = beforeP?.publishedVersion;
  const aVer = afterP?.publishedVersion;
  const bDrift = beforeP?.drift;
  const aDrift = afterP?.drift;

  switch (change) {
    case 'new_repo':
      return `New repo, ${aDrift} on ${registry}${aVer ? ` (${aVer})` : ''}`;
    case 'removed_repo':
      return `Repo removed (was ${bDrift} on ${registry})`;
    case 'new_drift':
      return `${bDrift} → ${aDrift}${aVer ? ` (published ${aVer})` : ''}`;
    case 'resolved':
      return `${bDrift} → ${aDrift}${aVer ? ` (${aVer})` : ''}`;
    case 'worsened':
      return `${bDrift} → ${aDrift}${bVer && aVer ? ` (${bVer} → ${aVer})` : ''}`;
    case 'unchanged':
      return `Unchanged (${aDrift ?? bDrift}${aVer ? ` ${aVer}` : ''})`;
  }
}

/** All registries that appear in either audit. */
function collectRegistries(before: AuditResult, after: AuditResult): Set<RegistryTarget> {
  const registries = new Set<RegistryTarget>();
  for (const row of [...before.rows, ...after.rows]) {
    for (const p of row.presence) {
      registries.add(p.registry);
    }
  }
  return registries;
}

export function diff(before: AuditResult, after: AuditResult): DiffResult {
  const beforeMap = new Map<string, AuditRow>();
  for (const row of before.rows) beforeMap.set(row.repo.name, row);

  const afterMap = new Map<string, AuditRow>();
  for (const row of after.rows) afterMap.set(row.repo.name, row);

  const allRepos = new Set([...beforeMap.keys(), ...afterMap.keys()]);
  const registries = collectRegistries(before, after);

  const entries: DiffEntry[] = [];

  for (const repo of allRepos) {
    const bRow = beforeMap.get(repo);
    const aRow = afterMap.get(repo);

    for (const registry of registries) {
      const bP = bRow ? findPresence(bRow, registry) : undefined;
      const aP = aRow ? findPresence(aRow, registry) : undefined;

      // Skip if this repo has no presence in this registry in either snapshot
      if (!bP && !aP) continue;

      const change = classifyChange(bP?.drift, aP?.drift);

      entries.push({
        repo,
        registry,
        change,
        before: bP ? { drift: bP.drift, version: bP.publishedVersion } : undefined,
        after: aP ? { drift: aP.drift, version: aP.publishedVersion } : undefined,
        details: describeChange(change, repo, registry, bP, aP),
      });
    }
  }

  // Sort: new_drift first, then worsened, resolved, new_repo, removed_repo, unchanged
  const changeOrder: Record<DriftChange, number> = {
    new_drift: 0,
    worsened: 1,
    resolved: 2,
    new_repo: 3,
    removed_repo: 4,
    unchanged: 5,
  };
  entries.sort((a, b) => {
    const oa = changeOrder[a.change];
    const ob = changeOrder[b.change];
    if (oa !== ob) return oa - ob;
    return a.repo.localeCompare(b.repo);
  });

  // Orphan diff
  const beforeOrphans = new Set(before.orphans.map((o) => `${o.registry}:${o.packageName}`));
  const afterOrphans = new Set(after.orphans.map((o) => `${o.registry}:${o.packageName}`));

  const addedOrphans = after.orphans.filter(
    (o) => !beforeOrphans.has(`${o.registry}:${o.packageName}`),
  );
  const removedOrphans = before.orphans.filter(
    (o) => !afterOrphans.has(`${o.registry}:${o.packageName}`),
  );

  const summary = {
    newDrift: entries.filter((e) => e.change === 'new_drift').length,
    resolved: entries.filter((e) => e.change === 'resolved').length,
    worsened: entries.filter((e) => e.change === 'worsened').length,
    unchanged: entries.filter((e) => e.change === 'unchanged').length,
    newRepos: entries.filter((e) => e.change === 'new_repo').length,
    removedRepos: entries.filter((e) => e.change === 'removed_repo').length,
    newOrphans: addedOrphans.length,
    removedOrphans: removedOrphans.length,
  };

  return {
    org: after.org,
    beforeDate: before.generatedAt,
    afterDate: after.generatedAt,
    entries,
    orphans: { added: addedOrphans, removed: removedOrphans },
    summary,
  };
}
