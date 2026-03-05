import type { SiteConfig } from '@mcptoolshop/site-theme';

export const config: SiteConfig = {
  title: '@mcptoolshop/registry-sync',
  description: 'Desired-state sync engine for multi-registry package publishing',
  logoBadge: 'RS',
  brandName: 'registry-sync',
  repoUrl: 'https://github.com/mcp-tool-shop-org/registry-sync',
  npmUrl: 'https://www.npmjs.com/package/@mcptoolshop/registry-sync',
  footerText: 'MIT Licensed — built by <a href="https://mcp-tool-shop.github.io/" style="color:var(--color-muted);text-decoration:underline">MCP Tool Shop</a>',

  hero: {
    badge: 'v1.0',
    headline: 'registry-sync',
    headlineAccent: 'Terraform for package registries.',
    description: 'Audit your GitHub org against npmjs and GHCR. Detect version drift, find orphaned packages, and generate action plans.',
    primaryCta: { href: '#usage', label: 'Get started' },
    secondaryCta: { href: 'handbook/', label: 'Read the Handbook' },
    previews: [
      { label: 'Audit', code: 'npx @mcptoolshop/registry-sync audit --org my-org' },
      { label: 'Plan', code: 'registry-sync plan --format markdown' },
      { label: 'Apply', code: 'registry-sync apply --confirm' },
    ],
  },

  sections: [
    {
      kind: 'features',
      id: 'features',
      title: 'How it works',
      subtitle: 'Desired state, plan, apply — like infrastructure-as-code for publishing.',
      features: [
        {
          title: 'Audit',
          desc: 'Scans every repo in your GitHub org, reads package.json and Dockerfile, queries npmjs and GHCR — builds a full presence matrix.',
        },
        {
          title: 'Plan',
          desc: 'Computes what needs to change: publish, update, scaffold CI workflows, or prune orphaned packages. Risk-rated and sorted.',
        },
        {
          title: 'Apply',
          desc: 'Executes the plan safely. Creates GitHub issues for drift and opens PRs for workflow scaffolding. Non-destructive by design.',
        },
      ],
    },
    {
      kind: 'code-cards',
      id: 'usage',
      title: 'Usage',
      cards: [
        {
          title: 'Install',
          code: 'npm install -g @mcptoolshop/registry-sync\n\n# Or use directly\nnpx @mcptoolshop/registry-sync audit',
        },
        {
          title: 'Library',
          code: "import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';\n\nconst config = loadConfig();\nconst result = await audit(config);\nconst actions = plan(result, config);\n\nconsole.log(actions.summary);",
        },
      ],
    },
    {
      kind: 'data-table',
      id: 'registries',
      title: 'Supported registries',
      columns: ['Registry', 'Audit', 'Apply'],
      rows: [
        ['npmjs.com', 'Version drift detection', 'Issue + workflow PR'],
        ['GHCR', 'Stale image + orphan detection', 'Workflow scaffold PR'],
        ['GitHub npm (v2)', 'Planned', 'Planned'],
        ['PyPI (v2)', 'Planned', 'Planned'],
      ],
    },
    {
      kind: 'features',
      id: 'details',
      title: 'Built right',
      subtitle: 'Zero dependencies. Ship-gated. API-only — no cloning required.',
      features: [
        {
          title: 'Zero deps',
          desc: 'Uses native fetch (Node 18+). No external runtime dependencies. Fast install, small footprint.',
        },
        {
          title: 'Non-destructive',
          desc: 'Apply creates GitHub issues and PRs only. No direct publish, no container push. Requires explicit --confirm.',
        },
        {
          title: 'Companion to registry-stats',
          desc: 'registry-stats reads download counts. registry-sync writes — audits, plans, and closes the loop.',
        },
      ],
    },
  ],
};
