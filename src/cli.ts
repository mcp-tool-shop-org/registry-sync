import { readFileSync, writeFileSync } from 'node:fs';
import { loadConfig } from './config.js';
import { audit } from './audit.js';
import { plan } from './plan.js';
import { apply } from './apply.js';
import { SyncError } from './errors.js';
import { formatAuditTable, formatPlanTable } from './format/table.js';
import { formatAuditJson, formatPlanJson, formatApplyJson } from './format/json.js';
import { formatAuditMarkdown, formatPlanMarkdown } from './format/markdown.js';
import type { OutputFormat, RegistryTarget, AuditResult } from './types.js';

// --- ANSI helpers ---

const BOLD = '\x1b[1m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RED = '\x1b[31m';
const CYAN = '\x1b[36m';
const DIM = '\x1b[2m';
const RESET = '\x1b[0m';

// --- Arg parsing ---

interface ParsedArgs {
  command: string;
  org?: string;
  format?: OutputFormat;
  target?: RegistryTarget | 'all';
  confirm?: boolean;
  profile?: string;
  repo?: string;
  includeArchived?: boolean;
  noSkip?: boolean;
  concurrency?: number;
  from?: string;
  out?: string;
  limit?: number;
}

function parseArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = { command: '' };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case '--org':
        args.org = argv[++i];
        break;
      case '--format':
      case '-f':
        args.format = argv[++i] as OutputFormat;
        break;
      case '--target':
      case '--type':
      case '-t':
        args.target = argv[++i] as RegistryTarget | 'all';
        break;
      case '--confirm':
        args.confirm = true;
        break;
      case '--profile':
        args.profile = argv[++i];
        break;
      case '--repo':
        args.repo = argv[++i];
        break;
      case '--include-archived':
        args.includeArchived = true;
        break;
      case '--no-skip':
        args.noSkip = true;
        break;
      case '--concurrency':
      case '-c': {
        const val = parseInt(argv[++i], 10);
        if (isNaN(val) || val < 1 || val > 20) {
          console.error(`${RED}Error:${RESET} --concurrency must be between 1 and 20`);
          process.exit(1);
        }
        args.concurrency = val;
        break;
      }
      case '--from': {
        args.from = argv[++i];
        break;
      }
      case '--out':
      case '-o':
        args.out = argv[++i];
        break;
      case '--limit': {
        const val = parseInt(argv[++i], 10);
        if (isNaN(val) || val < 1) {
          console.error(`${RED}Error:${RESET} --limit must be a positive integer`);
          process.exit(1);
        }
        args.limit = val;
        break;
      }
      case '--json':
        args.format = 'json';
        break;
      case '--help':
      case '-h':
        args.command = args.command || 'help';
        break;
      case '--version':
      case '-v':
        args.command = 'version';
        break;
      default:
        if (!arg.startsWith('-') && !args.command) {
          args.command = arg;
        }
        break;
    }
  }

  return args;
}

// --- Helpers ---

function loadAuditFromFile(filePath: string): AuditResult {
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as AuditResult;
    if (!data.org || !data.rows) {
      throw new SyncError(
        'INPUT_INVALID_FILE',
        `File ${filePath} is not a valid audit result`,
        'Run "registry-sync audit --json -o audit.json" first',
      );
    }
    return data;
  } catch (err) {
    if (err instanceof SyncError) throw err;
    throw new SyncError(
      'INPUT_FILE_NOT_FOUND',
      `Could not read ${filePath}: ${err instanceof Error ? err.message : String(err)}`,
      'Check the file path and try again',
    );
  }
}

// --- Commands ---

async function runAudit(args: ParsedArgs): Promise<void> {
  const config = loadConfig();
  if (args.org) config.org = args.org;

  const result = await audit(config, (p) => {
    process.stderr.write(`\r${DIM}${p.phase}... ${p.current}/${p.total || '?'}${RESET}`);
  }, { concurrency: args.concurrency });
  process.stderr.write('\r\x1b[K'); // Clear progress line

  const format = args.format || 'table';
  let output: string;
  switch (format) {
    case 'json':
      output = formatAuditJson(result);
      break;
    case 'markdown':
      output = formatAuditMarkdown(result);
      break;
    case 'table':
    default:
      output = formatAuditTable(result);
      break;
  }

  if (args.out) {
    writeFileSync(args.out, output, 'utf-8');
    process.stderr.write(`${GREEN}✓${RESET} Wrote audit to ${args.out}\n`);
  } else {
    console.log(output);
  }
}

async function runPlan(args: ParsedArgs): Promise<void> {
  const config = loadConfig();
  if (args.org) config.org = args.org;

  let auditResult: AuditResult;

  if (args.from) {
    process.stderr.write(`${DIM}Loading audit from ${args.from}...${RESET}\n`);
    auditResult = loadAuditFromFile(args.from);
    process.stderr.write(`${GREEN}✓${RESET} Loaded ${auditResult.rows.length} repos from ${args.from}\n`);
  } else {
    process.stderr.write(`${DIM}Running audit...${RESET}\n`);
    auditResult = await audit(config, (p) => {
      process.stderr.write(`\r${DIM}${p.phase}... ${p.current}/${p.total || '?'}${RESET}`);
    }, { concurrency: args.concurrency });
    process.stderr.write('\r\x1b[K');
  }

  const result = plan(auditResult, config, args.target);

  const format = args.format || 'table';
  let output: string;
  switch (format) {
    case 'json':
      output = formatPlanJson(result);
      break;
    case 'markdown':
      output = formatPlanMarkdown(result);
      break;
    case 'table':
    default:
      output = formatPlanTable(result);
      break;
  }

  if (args.out) {
    writeFileSync(args.out, output, 'utf-8');
    process.stderr.write(`${GREEN}✓${RESET} Wrote plan to ${args.out}\n`);
  } else {
    console.log(output);
  }
}

async function runApply(args: ParsedArgs): Promise<void> {
  if (!args.confirm) {
    console.log(
      `${YELLOW}Dry run — use --confirm to execute actions.${RESET}\n`,
    );
    // Show plan instead
    await runPlan(args);
    console.log(`\n${DIM}Run with --confirm to apply these actions.${RESET}`);
    return;
  }

  const config = loadConfig();
  if (args.org) config.org = args.org;

  let auditResult: AuditResult;

  if (args.from) {
    process.stderr.write(`${DIM}Loading audit from ${args.from}...${RESET}\n`);
    auditResult = loadAuditFromFile(args.from);
    process.stderr.write(`${GREEN}✓${RESET} Loaded ${auditResult.rows.length} repos from ${args.from}\n`);
  } else {
    process.stderr.write(`${DIM}Running audit...${RESET}\n`);
    auditResult = await audit(config, (p) => {
      process.stderr.write(`\r${DIM}${p.phase}... ${p.current}/${p.total || '?'}${RESET}`);
    }, { concurrency: args.concurrency });
    process.stderr.write('\r\x1b[K');
  }

  const planResult = plan(auditResult, config, args.target);

  const actionable = planResult.actions.filter((a) => a.type !== 'skip');
  const effectiveLimit = args.limit ?? actionable.length;

  process.stderr.write(
    `${BOLD}Applying ${Math.min(effectiveLimit, actionable.length)} of ${actionable.length} actions${RESET}` +
    (args.limit ? ` ${DIM}(--limit ${args.limit})${RESET}` : '') +
    '\n',
  );

  const result = await apply(planResult, config, (p) => {
    process.stderr.write(`\r${DIM}Applying... ${p.current}/${p.total}${RESET}`);
  }, { limit: args.limit });
  process.stderr.write('\r\x1b[K');

  const output = formatApplyJson(result);
  if (args.out) {
    writeFileSync(args.out, output, 'utf-8');
    process.stderr.write(`${GREEN}✓${RESET} Wrote results to ${args.out}\n`);
  } else {
    console.log(output);
  }

  const s = result.summary;
  console.error(
    `\n${GREEN}✓ ${s.succeeded} succeeded${RESET}  ${RED}${s.failed} failed${RESET}  ${DIM}${s.skipped} skipped${RESET}`,
  );
}

function printHelp(): void {
  console.log(`${BOLD}registry-sync${RESET} — Multi-registry package sync engine

${BOLD}Usage:${RESET}
  registry-sync <command> [flags]

${BOLD}Commands:${RESET}
  ${CYAN}audit${RESET}    Scan org repos and build presence matrix
  ${CYAN}plan${RESET}     Generate action plan from audit
  ${CYAN}apply${RESET}    Execute the plan (requires --confirm)
  ${CYAN}help${RESET}     Show this help message

${BOLD}Common Flags:${RESET}
  --org <org>          GitHub org to scan (default: from config)
  --format <fmt>       Output format: table, json, markdown (default: table)
  --json               Shorthand for --format json
  --target <target>    Filter by registry: npmjs, ghcr, all (default: all)
  --type <target>      Alias for --target
  --out <file>         Write output to file instead of stdout
  --include-archived   Include archived repos in audit

${BOLD}Scale Flags:${RESET}
  --concurrency <n>    Parallel GitHub API requests (1-20, default: 5)
  --from <file>        Load audit from file instead of re-running
  --limit <n>          Apply at most N actions (wave batching)

${BOLD}Apply Flags:${RESET}
  --confirm            Required for apply — execute actions
  --no-skip            Hide skip actions from plan output

${BOLD}Examples:${RESET}
  ${DIM}# Full audit → save to file${RESET}
  registry-sync audit --org my-org --json -o audit.json

  ${DIM}# Plan from saved audit, npm only${RESET}
  registry-sync plan --from audit.json --target npmjs

  ${DIM}# Apply first 20 actions from saved audit${RESET}
  registry-sync apply --from audit.json --confirm --limit 20

${BOLD}Config:${RESET}
  Place ${CYAN}registry-sync.config.json${RESET} in your project root.
  Falls back to sensible defaults if not found.

${BOLD}Auth:${RESET}
  Set ${CYAN}GITHUB_TOKEN${RESET} env var or run ${CYAN}gh auth login${RESET}.

${DIM}Built by MCP Tool Shop — https://mcp-tool-shop.github.io/${RESET}`);
}

function printVersion(): void {
  console.log('1.0.3');
}

// --- Main ---

async function main(): Promise<void> {
  const args = parseArgs(process.argv.slice(2));

  try {
    switch (args.command) {
      case 'audit':
        await runAudit(args);
        break;
      case 'plan':
        await runPlan(args);
        break;
      case 'apply':
        await runApply(args);
        break;
      case 'version':
        printVersion();
        break;
      case '':
      case 'help':
        printHelp();
        break;
      default:
        console.error(
          `${RED}Error [INPUT_UNKNOWN_COMMAND]:${RESET} Unknown command: ${args.command}`,
        );
        console.error(`${DIM}Hint: Run 'registry-sync help' for usage${RESET}`);
        process.exit(1);
    }
  } catch (err) {
    if (err instanceof SyncError) {
      console.error(`${RED}Error [${err.code}]:${RESET} ${err.message}`);
      console.error(`${DIM}Hint: ${err.hint}${RESET}`);
      process.exit(err.code.startsWith('AUTH_') || err.code.startsWith('INPUT_') ? 1 : 2);
    }
    console.error(`${RED}Unexpected error:${RESET}`, err);
    process.exit(2);
  }
}

main();
