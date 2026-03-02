import type {
  SyncConfig,
  AuditResult,
  AuditRow,
  RepoInfo,
  RegistryPresence,
  OrphanEntry,
} from './types.js';
import { pLimit } from './fetch.js';
import { compareSemver } from './semver.js';
import {
  listOrgRepos,
  readPackageJson,
  hasDockerfile as checkDockerfile,
  hasPublishWorkflow,
} from './providers/github.js';
import { getNpmPackageInfo } from './providers/npm.js';
import { listGhcrPackages } from './providers/ghcr.js';

const CONCURRENCY = 5;

export interface AuditProgress {
  phase: string;
  current: number;
  total: number;
}

export async function audit(
  config: SyncConfig,
  onProgress?: (p: AuditProgress) => void,
): Promise<AuditResult> {
  const progress = (phase: string, current: number, total: number) =>
    onProgress?.({ phase, current, total });

  // 1. List all org repos
  progress('Listing repos', 0, 0);
  const allRepos = await listOrgRepos(config.org);
  progress('Listing repos', allRepos.length, allRepos.length);

  // 2. Filter
  const repos = allRepos.filter(
    (r) => !r.archived && !config.exclude.includes(r.name),
  );

  // 3. Enrich each repo with package.json + Dockerfile info
  const limit = pLimit(CONCURRENCY);
  const enriched: RepoInfo[] = [];
  let done = 0;

  await Promise.all(
    repos.map((repo) =>
      limit(async () => {
        const [owner] = repo.fullName.split('/');
        const pkg = await readPackageJson(owner, repo.name);
        const dockerfile = await checkDockerfile(owner, repo.name);

        const enrichedRepo: RepoInfo = {
          ...repo,
          hasPackageJson: pkg !== null,
          hasDockerfile: dockerfile,
          packageJsonName: pkg?.name,
          packageJsonVersion: pkg?.version,
          packageJsonPrivate: pkg?.private,
        };

        enriched.push(enrichedRepo);
        done++;
        progress('Scanning repos', done, repos.length);
      }),
    ),
  );

  // 4. Check npm presence for repos with package.json
  const rows: AuditRow[] = [];
  done = 0;
  const npmCandidates = enriched.filter(
    (r) => r.hasPackageJson && !r.packageJsonPrivate && r.packageJsonName,
  );

  await Promise.all(
    npmCandidates.map((repo) =>
      limit(async () => {
        const npmInfo = await getNpmPackageInfo(repo.packageJsonName!);
        const presence: RegistryPresence[] = [];

        if (config.targets.npm.enabled) {
          if (npmInfo) {
            const cmp = compareSemver(
              repo.packageJsonVersion || '0.0.0',
              npmInfo.latestVersion,
            );
            presence.push({
              registry: 'npmjs',
              published: true,
              publishedVersion: npmInfo.latestVersion,
              lastPublished: npmInfo.lastPublished,
              drift: cmp === 1 ? 'behind' : cmp === 0 ? 'current' : 'current',
            });
          } else {
            presence.push({
              registry: 'npmjs',
              published: false,
              drift: 'missing',
            });
          }
        }

        rows.push({ repo, presence });
        done++;
        progress('Checking npm', done, npmCandidates.length);
      }),
    ),
  );

  // Add rows for repos without npm presence (private, no package.json, etc.)
  for (const repo of enriched) {
    if (rows.some((r) => r.repo.name === repo.name)) continue;

    const presence: RegistryPresence[] = [];
    if (config.targets.npm.enabled) {
      if (repo.packageJsonPrivate) {
        presence.push({ registry: 'npmjs', published: false, drift: 'private' });
      } else if (!repo.hasPackageJson) {
        // No package.json — npm not applicable, omit from presence
      }
    }
    rows.push({ repo, presence });
  }

  // 5. Check GHCR presence
  const orphans: OrphanEntry[] = [];

  if (config.targets.ghcr.enabled) {
    progress('Checking GHCR', 0, 0);
    const containers = await listGhcrPackages(config.org);
    const repoNames = new Set(enriched.map((r) => r.name));

    for (const container of containers) {
      // Normalize: GHCR names may use nested paths like "claude-toolstack/gateway"
      const baseName = container.name.split('/')[0];

      if (repoNames.has(baseName) || repoNames.has(container.name)) {
        // Find matching row and add GHCR presence
        const row = rows.find(
          (r) => r.repo.name === baseName || r.repo.name === container.name,
        );
        if (row) {
          row.presence.push({
            registry: 'ghcr',
            published: true,
            lastPublished: container.updatedAt,
            drift: 'current', // Can't easily compare container versions in v1
          });
        }
      } else {
        orphans.push({
          registry: 'ghcr',
          packageName: container.name,
          lastPublished: container.updatedAt,
        });
      }
    }

    // Add GHCR "missing" for repos with Dockerfile but no container
    for (const row of rows) {
      if (
        row.repo.hasDockerfile &&
        !row.presence.some((p) => p.registry === 'ghcr')
      ) {
        row.presence.push({
          registry: 'ghcr',
          published: false,
          drift: 'missing',
        });
      }
    }

    progress('Checking GHCR', containers.length, containers.length);
  }

  // Sort rows: actionable first, then alphabetical
  rows.sort((a, b) => {
    const aScore = a.presence.some((p) => p.drift === 'behind' || p.drift === 'missing') ? 0 : 1;
    const bScore = b.presence.some((p) => p.drift === 'behind' || p.drift === 'missing') ? 0 : 1;
    if (aScore !== bScore) return aScore - bScore;
    return a.repo.name.localeCompare(b.repo.name);
  });

  return {
    org: config.org,
    generatedAt: new Date().toISOString(),
    repoCount: enriched.length,
    rows,
    orphans,
  };
}
