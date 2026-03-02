// --- Registry identifiers ---

export type RegistryTarget = 'npmjs' | 'github-npm' | 'ghcr';

export type DriftStatus =
  | 'current'   // repo version === published version
  | 'behind'    // repo version > published version
  | 'missing'   // repo has package.json but not published
  | 'orphan'    // published but no matching repo
  | 'private'   // repo marked private or package.json private
  | 'excluded'; // repo in exclude list

export type ActionType =
  | 'publish'            // first-time publish
  | 'update'             // version bump needed
  | 'scaffold-workflow'  // add CI publish workflow
  | 'prune'              // orphaned image/package
  | 'skip';              // no action needed

export type RiskLevel = 'low' | 'medium' | 'high';
export type OutputFormat = 'table' | 'json' | 'markdown';

// --- Repo info (from GitHub API) ---

export interface RepoInfo {
  name: string;
  fullName: string;
  language: string | null;
  archived: boolean;
  isPrivate: boolean;
  pushedAt: string;
  topics: string[];
  defaultBranch: string;
  hasPackageJson: boolean;
  hasDockerfile: boolean;
  packageJsonName?: string;
  packageJsonVersion?: string;
  packageJsonPrivate?: boolean;
}

// --- Registry presence ---

export interface RegistryPresence {
  registry: RegistryTarget;
  published: boolean;
  publishedVersion?: string;
  lastPublished?: string;
  drift: DriftStatus;
}

// --- Audit ---

export interface AuditRow {
  repo: RepoInfo;
  presence: RegistryPresence[];
}

export interface AuditResult {
  org: string;
  generatedAt: string;
  repoCount: number;
  rows: AuditRow[];
  orphans: OrphanEntry[];
}

export interface OrphanEntry {
  registry: RegistryTarget;
  packageName: string;
  lastPublished?: string;
}

// --- Plan ---

export interface PlannedAction {
  type: ActionType;
  target: RegistryTarget;
  repo: string;
  fromVersion?: string;
  toVersion?: string;
  details: string;
  risk: RiskLevel;
}

export interface PlanResult {
  org: string;
  generatedAt: string;
  actions: PlannedAction[];
  summary: {
    publish: number;
    update: number;
    scaffold: number;
    prune: number;
    skip: number;
  };
}

// --- Apply ---

export interface ApplyAction {
  action: PlannedAction;
  success: boolean;
  url?: string;
  error?: string;
}

export interface ApplyResult {
  org: string;
  appliedAt: string;
  results: ApplyAction[];
  summary: {
    succeeded: number;
    failed: number;
    skipped: number;
  };
}

// --- Config ---

export interface SyncConfig {
  org: string;
  exclude: string[];
  targets: {
    npm: { enabled: boolean };
    ghcr: { enabled: boolean };
  };
  workflowProfiles: Record<string, string>;
}

// --- Provider data ---

export interface NpmPackageInfo {
  name: string;
  latestVersion: string;
  lastPublished: string;
}

export interface ContainerPackage {
  name: string;
  packageType: string;
  createdAt: string;
  updatedAt: string;
  visibility: string;
}
