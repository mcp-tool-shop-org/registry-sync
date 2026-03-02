import type { AuditResult, PlanResult, ApplyResult } from '../types.js';

export function formatAuditJson(result: AuditResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatPlanJson(result: PlanResult): string {
  return JSON.stringify(result, null, 2);
}

export function formatApplyJson(result: ApplyResult): string {
  return JSON.stringify(result, null, 2);
}
