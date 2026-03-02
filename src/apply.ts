import type {
  PlanResult,
  SyncConfig,
  ApplyResult,
  ApplyAction,
  PlannedAction,
} from './types.js';
import { fetchGitHub } from './fetch.js';
import { SyncError } from './errors.js';
import { getGitHubToken } from './auth.js';

export interface ApplyOptions {
  limit?: number;
}

export interface ApplyProgress {
  current: number;
  total: number;
}

export async function apply(
  planResult: PlanResult,
  config: SyncConfig,
  onProgress?: (p: ApplyProgress) => void,
  options?: ApplyOptions,
): Promise<ApplyResult> {
  let actionable = planResult.actions.filter((a) => a.type !== 'skip');

  // Apply limit if set
  if (options?.limit && options.limit > 0) {
    actionable = actionable.slice(0, options.limit);
  }

  const results: ApplyAction[] = [];
  let succeeded = 0;
  let failed = 0;
  const skipped = planResult.summary.skip;

  for (let i = 0; i < actionable.length; i++) {
    onProgress?.({ current: i + 1, total: actionable.length });
    const action = actionable[i];

    try {
      const url = await executeAction(action, config);
      results.push({ action, success: true, url });
      succeeded++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ action, success: false, error: msg });
      failed++;
    }
  }

  return {
    org: planResult.org,
    appliedAt: new Date().toISOString(),
    results,
    summary: { succeeded, failed, skipped },
  };
}

async function executeAction(
  action: PlannedAction,
  config: SyncConfig,
): Promise<string | undefined> {
  switch (action.type) {
    case 'publish':
    case 'update':
      return createIssue(config.org, action);
    case 'scaffold-workflow':
      return createWorkflowPR(config.org, action);
    case 'prune':
      return createIssue(config.org, action);
    default:
      return undefined;
  }
}

async function createIssue(
  org: string,
  action: PlannedAction,
): Promise<string> {
  const titleMap: Record<string, string> = {
    publish: `registry-sync: Publish to ${action.target}`,
    update: `registry-sync: Update ${action.target} (${action.fromVersion} → ${action.toVersion})`,
    prune: `registry-sync: Orphaned ${action.target} package`,
  };

  const title = titleMap[action.type] || `registry-sync: ${action.type}`;
  const body = buildIssueBody(action);
  const token = getGitHubToken();

  const res = await fetch(
    `https://api.github.com/repos/${org}/${action.repo}/issues`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title,
        body,
        labels: ['registry-sync'],
      }),
    },
  );

  if (!res.ok) {
    if (res.status === 422) {
      const retry = await fetch(
        `https://api.github.com/repos/${org}/${action.repo}/issues`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ title, body }),
        },
      );
      if (!retry.ok) {
        throw new SyncError(
          'APPLY_FAILED',
          `Failed to create issue on ${org}/${action.repo}: ${retry.status}`,
          'Check token has repo write permissions',
        );
      }
      const data = (await retry.json()) as { html_url: string };
      return data.html_url;
    }
    throw new SyncError(
      'APPLY_FAILED',
      `Failed to create issue on ${org}/${action.repo}: ${res.status}`,
      'Check token has repo write permissions',
    );
  }

  const data = (await res.json()) as { html_url: string };
  return data.html_url;
}

function buildIssueBody(action: PlannedAction): string {
  const lines: string[] = [];

  lines.push('## registry-sync Action');
  lines.push('');
  lines.push(`**Type:** ${action.type}`);
  lines.push(`**Target:** ${action.target}`);
  lines.push(`**Risk:** ${action.risk}`);
  lines.push('');
  lines.push(`**Details:** ${action.details}`);

  if (action.type === 'publish') {
    lines.push('');
    lines.push('### Steps to resolve');
    lines.push('');
    lines.push('1. Ensure `package.json` has correct `name`, `version`, `description`');
    lines.push('2. Run `npm pack --dry-run` to verify contents');
    lines.push('3. Run `npm publish --access public`');
    lines.push('4. Add a publish workflow for future releases');
  } else if (action.type === 'update') {
    lines.push('');
    lines.push('### Steps to resolve');
    lines.push('');
    lines.push(`1. Current published version: **${action.fromVersion}**`);
    lines.push(`2. Repository version: **${action.toVersion}**`);
    lines.push('3. Run `npm publish` or create a GitHub release to trigger publish workflow');
  } else if (action.type === 'prune') {
    lines.push('');
    lines.push('### Steps to resolve');
    lines.push('');
    lines.push('This package exists on the registry but has no matching repository.');
    lines.push('');
    lines.push('- If the repo was renamed/moved: update the package or redirect');
    lines.push('- If the repo was deleted: consider deprecating/removing the package');
    lines.push('- If this is intentional: close this issue');
  }

  lines.push('');
  lines.push('---');
  lines.push('_Generated by [registry-sync](https://github.com/mcp-tool-shop-org/registry-sync)_');

  return lines.join('\n');
}

async function createWorkflowPR(
  org: string,
  action: PlannedAction,
): Promise<string> {
  const token = getGitHubToken();
  const repo = action.repo;
  const branchName = 'registry-sync/add-publish-workflow';

  const repoData = await fetchGitHub<{ default_branch: string }>(
    `/repos/${org}/${repo}`,
  );
  if (!repoData) {
    throw new SyncError('APPLY_FAILED', `Repo ${org}/${repo} not found`, '');
  }

  const refData = await fetchGitHub<{ object: { sha: string } }>(
    `/repos/${org}/${repo}/git/ref/heads/${repoData.default_branch}`,
  );
  if (!refData) {
    throw new SyncError('APPLY_FAILED', `Could not get ref for ${repo}`, '');
  }
  const baseSha = refData.object.sha;

  const createRef = await fetch(
    `https://api.github.com/repos/${org}/${repo}/git/refs`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: baseSha,
      }),
    },
  );

  if (!createRef.ok && createRef.status !== 422) {
    throw new SyncError(
      'APPLY_FAILED',
      `Failed to create branch on ${repo}: ${createRef.status}`,
      'Check token permissions',
    );
  }

  const workflowContent = generatePublishWorkflow();
  const contentRes = await fetch(
    `https://api.github.com/repos/${org}/${repo}/contents/.github/workflows/publish.yml`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Add npm publish workflow (registry-sync)',
        content: Buffer.from(workflowContent).toString('base64'),
        branch: branchName,
      }),
    },
  );

  if (!contentRes.ok) {
    throw new SyncError(
      'APPLY_FAILED',
      `Failed to create workflow file on ${repo}: ${contentRes.status}`,
      'Check token permissions and workflow scope',
    );
  }

  const prRes = await fetch(
    `https://api.github.com/repos/${org}/${repo}/pulls`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: 'Add npm publish workflow (registry-sync)',
        body: 'Adds a GitHub Actions workflow to publish to npm on release.\n\nGenerated by [registry-sync](https://github.com/mcp-tool-shop-org/registry-sync).',
        head: branchName,
        base: repoData.default_branch,
      }),
    },
  );

  if (!prRes.ok) {
    throw new SyncError(
      'APPLY_FAILED',
      `Failed to create PR on ${repo}: ${prRes.status}`,
      'Check token permissions',
    );
  }

  const prData = (await prRes.json()) as { html_url: string };
  return prData.html_url;
}

function generatePublishWorkflow(): string {
  return `name: Publish

on:
  release:
    types: [published]
  workflow_dispatch:

concurrency:
  group: \${{ github.workflow }}-\${{ github.ref }}
  cancel-in-progress: true

jobs:
  publish:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          registry-url: https://registry.npmjs.org
      - run: npm ci
      - run: npm run build --if-present
      - run: npm test --if-present
      - run: npm publish --access public --provenance
        env:
          NODE_AUTH_TOKEN: \${{ secrets.NPM_TOKEN }}
`;
}
