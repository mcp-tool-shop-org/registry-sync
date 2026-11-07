<p align="center">
  <a href="README.md">English</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

複数のレジストリにパッケージを公開するための、目的の状態を同期するエンジン。 GitHub組織をnpmjsおよびGHCRに対して監査し、バージョンズレを検出し、孤立したパッケージを見つけ、アクションプランを生成します。パッケージレジストリ向けのTerraformのようなものです。

[`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats) の書き込み側のコンパニオンツール。

## インストール

```bash
npm install -g @mcptoolshop/registry-sync
```

または、直接使用します。

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## クイックスタート

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

## コマンド

### `audit`

GitHub組織内のすべてのリポジトリをスキャンし、各リポジトリの`package.json`を読み取り、`Dockerfile`をチェックし、次にnpmjsとGHCRにクエリを送信して、存在状況のマトリックスを作成します。

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

出力は、レジストリごとのドリフト状態を示します。
- **✓** current — 公開されたバージョンがリポジトリと一致
- **⚠** behind — リポジトリのバージョンが公開バージョンより古い
- **↓** ahead — 公開されたバージョンがリポジトリより新しい（ロールバックまたはホットフィックス）
- **missing** — まだ公開されていない
- **○** orphan — 公開されているが、対応するリポジトリがない

### `plan`

監査を実行し、リスクレベル付きのアクションプランを生成します。

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

アクションの種類：
- **publish** — レジストリへの初回公開
- **update** — バージョン更新が必要（リポジトリが公開バージョンより新しい）
- **scaffold-workflow** — PR経由でCI公開ワークフローを追加
- **prune** — 孤立したパッケージのクリーンアップが必要

### `diff`

2つの監査スナップショットを比較し、実行間で何が変更されたかを表示します。新しいドリフト、解決されたドリフト、悪化したドリフト、新しい/削除されたリポジトリ、および孤立したパッケージの変更。

```
registry-sync diff --before audit-old.json --from audit-new.json [--format table|json|markdown]
```

以前に保存された2つの監査JSONファイル（`registry-sync audit --json -o <file>`から）が必要です。新しいAPI呼び出しは行われません。差分は、2つのスナップショットに対する純粋な計算です。

変更の種類：
- **new_drift** — リポジトリは最新の状態でしたが、現在は古い/存在しない/新しい
- **resolved** — ドリフトが存在していましたが、現在は最新の状態
- **worsened** — ドリフトが悪化（例：古い → 存在しない）
- **new_repo** / **removed_repo** — スナップショット間でリポジトリが追加または削除

### `apply`

プランを実行します。すべての操作は、v1では破壊的な操作ではありません。
- 公開/更新/削除アクションに対して、GitHub **issue**を作成します
- スキャフォールドアクションに対して、CIワークフローファイルを含むGitHub **PR**を開きます

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

`--confirm`がない場合、ドライラン（`plan`と同じ）を表示します。

## 設定

プロジェクトのルートに`registry-sync.config.json`を配置します。

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

設定ファイルが見つからない場合、適切なデフォルト値が使用されます。

## 認証

`repo`スコープを持つGitHubトークンが必要です。

1. `GITHUB_TOKEN`環境変数（推奨）
2. `gh auth token`フォールバック（GitHubCLIがインストールされている場合）

v1ではnpmトークンは必要ありません（読み取り専用のレジストリクエリ）。

## ライブラリの使用

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

## セキュリティと脅威モデル

完全なセキュリティモデルについては、[SECURITY.md](./SECURITY.md)を参照してください。

**対象となるもの：** パブリックなGitHubAPI（リポジトリのメタデータ、ファイルの内容、issue、PR）およびパブリックなnpmレジストリ（読み取り専用のパッケージメタデータ）。 `apply --confirm`が使用されている場合、書き込みアクセス権を持つリポジトリにissueとPRを作成します。

**対象とならないもの：** ローカルファイルは変更されません（読み取り専用の設定の参照）。 npm publish、Docker push、認証情報の保存は行いません。 GitHub/npm API呼び出しを超えて、データがマシンから外部に送信されることはありません。

**必要な権限：** 監査用の読み取り、適用用の書き込み権限を持つ、`repo`スコープを持つGitHubトークン。 npmトークンは必要ありません。

**テレメトリはありません。** 分析もありません。 ホームへの接続もありません。 あらゆる種類のデータ収集も行いません。

---

<a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>によって構築されました。
