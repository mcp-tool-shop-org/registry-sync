// Library exports
export { audit } from './audit.js';
export { plan } from './plan.js';
export { apply } from './apply.js';
export { loadConfig, defaultConfig, starterConfig } from './config.js';
export { SyncError, wrapError } from './errors.js';
export { compareSemver, isDrift } from './semver.js';

// Types
export type {
  RegistryTarget,
  DriftStatus,
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
} from './types.js';
