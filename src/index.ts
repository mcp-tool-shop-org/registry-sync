// Library exports
export { audit } from './audit.js';
export type { AuditOptions, AuditProgress } from './audit.js';
export { plan } from './plan.js';
export { apply } from './apply.js';
export type { ApplyOptions, ApplyProgress } from './apply.js';
export { loadConfig, defaultConfig, starterConfig } from './config.js';
export { SyncError, wrapError } from './errors.js';
export { compareSemver, isDrift } from './semver.js';
export { diff } from './diff.js';

// Formatters
export { formatDiffTable, formatDiffJson, formatDiffMarkdown } from './format/diff.js';

// Types
export type {
  RegistryTarget,
  DriftStatus,
  SkipReason,
  ActionType,
  RiskLevel,
  OutputFormat,
  RepoInfo,
  RegistryPresence,
  AuditRow,
  AuditResult,
  OrphanEntry,
  PlannedAction,
  PlanResult,
  ApplyAction,
  ApplyResult,
  SyncConfig,
  NpmPackageInfo,
  ContainerPackage,
  DriftChange,
  DiffEntry,
  DiffResult,
} from './types.js';
