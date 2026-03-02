import { loadConfig } from './config.js';
import { audit } from './audit.js';
import { plan } from './plan.js';
import { apply } from './apply.js';
import { SyncError } from './errors.js';
import { formatAuditTable, formatPlanTable } from './format/table.js';
import { formatAuditJson, formatPlanJson, formatApplyJson } from './format/json.js';
import { formatAuditMarkdown, formatPlanMarkdown } from './format/markdown.js';
import type { OutputFormat, RegistryTarget } from './types.js';

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

// --- Commands ---

async function runAudit(args: ParsedArgs): Promise<void> {
  const config = loadConfig();
  if (args.org) config.org = args.org;

  const result = await audit(config, (p) => {
    process.stderr.write(`\r${DIM}${p.phase}... ${p.current}/${p.total || '?'}${RESET}`);
  });
  process.stderr.write('\r\x1b[K'); // Clear progress line

  const format = args.format || 'table';
  switch (format) {
    case 'table':
      console.log(formatAuditTable(result));
      break;
    case 'json':
      console.log(formatAuditJson(result));
      break;
    case 'markdown':
      console.log(formatAuditMarkdown(result));
      break;
  }
}

async function runPlan(args: ParsedArgs): Promise<void> {
  const config = loadConfig();
  if (args.org) config.org = args.org;

  process.stderr.write(`${DIM}Running audit...${RESET}\n`);
  const auditResult = await audit(config, (p) => {
    process.stderr.write(`\r${DIM}${p.phase}... ${p.current}/${p.total || '?'}${RESET}`);
  });
  process.stderr.write('\r\x1b[K');

  const result = plan(auditResult, config, args.target);

  const format = args.format || 'table';
  switch (format) {
    case 'table':
      console.log(formatPlanTable(result));
      break;
    case 'json':
      console.log(formatPlanJson(result));
      break;
    case 'markdown':
      console.log(formatPlanMarkdown(result));
      break;
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

  process.stderr.write(`${DIM}Running audit...${RESET}\n`);
  const auditResult = await audit(config, (p) => {
    process.stderr.write(`\r${DIM}${p.phase}... ${p.current}/${p.total || '?'}${RESET}`);
  });
  process.stderr.write('\r\x1b[K');

  const planResult = plan(auditResult, config, args.target);
  const result = await apply(planResult, config, (p) => {
    process.stderr.write(`\r${DIM}Applying... ${p.current}/${p.total}${RESET}`);
  });
  process.stderr.write('\r\x1b[K');

  const format = args.format || 'json';
  console.log(formatApplyJson(result));

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

${BOLD}Flags:${RESET}
  --org <org>          GitHub org to scan (default: from config)
  --format <fmt>       Output format: table, json, markdown (default: table)
  --target <target>    Filter by registry: npmjs, ghcr, all (default: all)
  --confirm            Required for apply — execute actions
  --include-archived   Include archived repos in audit
  --no-skip            Hide skip actions from plan output

${BOLD}Config:${RESET}
  Place ${CYAN}registry-sync.config.json${RESET} in your project root.
  Falls back to sensible defaults if not found.

${BOLD}Auth:${RESET}
  Set ${CYAN}GITHUB_TOKEN${RESET} env var or run ${CYAN}gh auth login${RESET}.

${DIM}Built by MCP Tool Shop — https://mcp-tool-shop.github.io/${RESET}`);
}

function printVersion(): void {
  // Read version from package.json at build time isn't simple with tsup,
  // so we hardcode and keep in sync with package.json
  console.log('1.0.0');
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
