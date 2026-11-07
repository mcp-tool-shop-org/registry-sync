<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.md">English</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
</p>

<p align="center">
  <a href="https://mcp-tool-shop-org.github.io/registry-sync/">
    <img src="https://raw.githubusercontent.com/mcp-tool-shop-org/brand/main/logos/registry-sync/readme.png" width="400" alt="registry-sync" />
  </a>
</p>

<p align="center">
  <a href="https://github.com/mcp-tool-shop-org/registry-sync/actions/workflows/ci.yml"><img src="https://github.com/mcp-tool-shop-org/registry-sync/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://www.npmjs.com/package/@mcptoolshop/registry-sync"><img src="https://img.shields.io/npm/v/@mcptoolshop/registry-sync" alt="npm" /></a>
  <a href="https://github.com/mcp-tool-shop-org/registry-sync/blob/main/LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License" /></a>
  <a href="https://mcp-tool-shop-org.github.io/registry-sync/"><img src="https://img.shields.io/badge/Landing_Page-live-blue" alt="Landing Page" /></a>
</p>

用于多注册表软件包发布的期望状态同步引擎。它会审核您的 GitHub 组织，与 npmjs 和 GHCR 进行比较，检测版本漂移，查找孤立软件包，并生成操作计划——类似于 Terraform，但用于软件包注册表。

它是 [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats) 的写入端配套工具。

## 安装

```bash
npm install -g @mcptoolshop/registry-sync
```

或者直接使用：

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## 快速入门

```bash
# Set your GitHub token
export GITHUB_TOKEN=ghp_...

# Audit your org — see what's published, what's drifted, what's missing
registry-sync audit --org mcp-tool-shop-org

# Generate an action plan
registry-sync plan --org mcp-tool-shop-org

# Execute the plan (creates GitHub issues + PRs)
registry-sync apply --confirm
```

## 命令

### `audit`

扫描 GitHub 组织中的所有仓库，读取每个仓库的 `package.json`，并检查 `Dockerfile`，然后查询 npmjs 和 GHCR，以构建存在性矩阵。

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

输出显示每个注册表的漂移状态：
- **✓** current（当前）——已发布版本与仓库匹配
- **⚠** behind（滞后）——仓库版本领先于已发布版本
- **↓** ahead（领先）——已发布版本领先于仓库（需要回滚或快速修复）
- **missing**（缺失）——尚未发布
- **○** orphan（孤立）——已发布但没有匹配的仓库

### `plan`

运行审核并生成带有风险级别的操作计划。

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

操作类型：
- **publish**（发布）——首次发布到注册表
- **update**（更新）——需要版本更新（仓库版本领先于已发布版本）
- **scaffold-workflow**（构建工作流）——通过 PR 添加 CI 发布工作流
- **prune**（清理）——需要清理孤立软件包

### `diff`

比较两个审核快照，以显示两次运行之间发生的变化——新的漂移、已解决的漂移、加剧的漂移、新的/删除的仓库以及孤立软件包的变化。

```
registry-sync diff --before audit-old.json --from audit-new.json [--format table|json|markdown]
```

需要两个先前保存的审核 JSON 文件（来自 `registry-sync audit --json -o <file>`）。不会进行新的 API 调用——差异分析完全基于这两个快照的计算。

变化类型：
- **new_drift**（新的漂移）——仓库最初状态良好，现在变为滞后/缺失/领先
- **resolved**（已解决）——漂移已存在，现在状态良好
- **worsened**（加剧）——漂移加剧（例如，从滞后变为缺失）
- **new_repo** / **removed_repo**（新的仓库/删除的仓库）——快照之间添加或删除了仓库

### `apply`

执行计划。所有操作在 v1 中都是非破坏性的：
- 为发布/更新/清理操作创建 GitHub 个 **issue**
- 为构建操作打开带有 CI 工作流文件的 GitHub 个 **PR**

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

如果没有 `--confirm`，则显示模拟运行（与 `plan` 相同）。

## 配置

将 `registry-sync.config.json` 放在您的项目根目录中：

```json
{
  "org": "mcp-tool-shop-org",
  "exclude": [".github", "brand"],
  "targets": {
    "npm": { "enabled": true },
    "ghcr": { "enabled": true }
  }
}
```

如果没有找到配置文件，则回退到合理的默认设置。

## 身份验证

需要具有 `repo` 范围的 GitHub 令牌：

1. `GITHUB_TOKEN` 环境变量（首选）
2. `gh auth token` 回退（如果安装了 GitHub CLI）

在 v1 中不需要 npm 令牌（只读注册表查询）。

## 库的使用

```typescript
import { audit, plan, diff, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }

// Compare two snapshots
const oldAudit = JSON.parse(readFileSync('audit-old.json', 'utf-8'));
const diffResult = diff(oldAudit, auditResult);
console.log(diffResult.summary);
// { newDrift: 2, resolved: 1, worsened: 0, unchanged: 40, ... }
```

## 安全性和威胁模型

有关完整的安全模型，请参阅 [SECURITY.md](./SECURITY.md)。

**它会访问的内容：** 公共 GitHub API（仓库元数据、文件内容、issue、PR）以及公共 npm 注册表（只读软件包元数据）。当使用 `apply --confirm` 时，它会在您具有写入权限的仓库上创建 issue 和 PR。

**它不会访问的内容：** 不会修改任何本地文件（只读配置查找）。不会执行 npm 发布、Docker 推送或凭据存储。除了 GitHub/npm API 调用之外，不会有任何数据离开您的机器。

**所需的权限：** 具有 `repo` 范围的 GitHub 令牌（用于审核时读取，用于应用时写入）。不需要 npm 令牌。

**没有遥测数据。** 没有分析。没有“回家”功能。没有收集任何类型的数据。

---

由 <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a> 构建
