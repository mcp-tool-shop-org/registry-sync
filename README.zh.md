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

用于多注册表包发布的期望状态同步引擎。它会检查您的 GitHub 组织与 npmjs 和 GHCR 的一致性，检测版本偏差，查找孤立的包，并生成操作计划——就像为包注册表提供的 Terraform。

它是 [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats) 的配套工具（用于写入操作）。

## 安装

```bash
npm install -g @mcptoolshop/registry-sync
```

或者直接使用：

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## 快速开始

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

扫描 GitHub 组织中的所有仓库，读取每个仓库的 `package.json` 文件，并检查是否存在 `Dockerfile`，然后查询 npmjs 和 GHCR 以构建一个存在矩阵。

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

输出显示每个注册表的偏差状态：
- **✓** current — 已发布版本与仓库版本匹配
- **⚠** behind — 仓库版本比已发布版本更先进
- **missing** — 尚未发布
- **○** orphan — 已发布，但没有匹配的仓库

### `plan`

运行审计并生成带有风险级别的操作计划。

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

操作类型：
- **publish** — 首次发布到注册表
- **update** — 需要更新版本（仓库版本比已发布版本更先进）
- **scaffold-workflow** — 通过拉取请求添加 CI 发布工作流
- **prune** — 需要清理孤立的包

### `apply`

执行计划。在 v1 版本中，所有操作都是非破坏性的：
- 为发布/更新/清理操作创建 GitHub **问题**
- 为构建操作打开 GitHub **拉取请求**，其中包含 CI 工作流文件

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

如果不使用 `--confirm`，则执行模拟运行（与 `plan` 相同）。

## 配置

将 `registry-sync.config.json` 文件放在您的项目根目录下：

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

如果未找到配置文件，则使用默认配置。

## 身份验证

需要一个具有 `repo` 权限的 GitHub 令牌：

1. `GITHUB_TOKEN` 环境变量（推荐）
2. `gh auth token`（如果已安装 GitHub CLI）

在 v1 版本中，不需要 npm 令牌（只进行只读的注册表查询）。

## 库的使用

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

## 安全性和威胁模型

请参阅 [SECURITY.md](./SECURITY.md) 以获取完整的安全模型。

**它会访问的内容：** 公开的 GitHub API（仓库元数据、文件内容、问题、拉取请求）以及公共的 npm 注册表（只读的包元数据）。当使用 `apply --confirm` 时，它会在您具有写入权限的仓库上创建问题和拉取请求。

**它不会访问的内容：** 不会修改任何本地文件（只读的配置文件查找）。 不会进行 npm 发布，不会推送 Docker 镜像，不会存储凭据。 没有数据会离开您的机器，除了对 GitHub/npm API 的调用。

**所需的权限：** 具有 `repo` 权限的 GitHub 令牌（用于审计的读取权限，用于执行的写入权限）。 不需要 npm 令牌。

**没有遥测。** 没有分析。 没有自动报告。 没有任何类型的数据收集。

---

由 <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a> 构建。
