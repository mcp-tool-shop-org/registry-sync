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

マルチレジストリパッケージ公開のための、理想の状態を同期するエンジンです。GitHub組織をnpmjsおよびGHCRに対して監査し、バージョンズレを検出し、孤立したパッケージを見つけ、アクションプランを生成します。これは、パッケージレジストリのためのTerraformのようなものです。

[`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats)の書き込み側のコンポーネントです。

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

GitHub組織内のすべてのリポジトリをスキャンし、各リポジトリの`package.json`を読み込み、`Dockerfile`の有無を確認し、次にnpmjsおよびGHCRに対してクエリを実行して、存在状況のマトリックスを構築します。

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

出力は、レジストリごとの状態を示します。
- **✓** current：公開バージョンがリポジトリと一致
- **⚠** behind：リポジトリのバージョンが公開されているバージョンよりも新しい
- **missing**：まだ公開されていない
- **○** orphan：公開されているが、対応するリポジトリがない

### `plan`

監査を実行し、リスクレベルとともにアクションプランを生成します。

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

アクションの種類：
- **publish**：レジストリへの初回公開
- **update**：バージョンを更新する必要がある（リポジトリが公開されているバージョンよりも新しい）
- **scaffold-workflow**：PRを通じてCI公開ワークフローを追加
- **prune**：孤立したパッケージをクリーンアップする必要がある

### `apply`

プランを実行します。v1では、すべての操作は破壊的な変更を加えません。
- 公開/更新/クリーンアップのアクションについて、GitHubの**イシュー**を作成します。
- スキャフォールドアクションについては、CIワークフローファイルを含むGitHubの**プルリクエスト**を開きます。

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

`--confirm`オプションなしで実行すると、テスト実行（`plan`と同じ）を行います。

## 設定

プロジェクトのルートディレクトリに`registry-sync.config.json`を配置します。

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

設定ファイルが見つからない場合は、デフォルトの設定が使用されます。

## 認証

`repo`スコープを持つGitHubトークンが必要です。

1. `GITHUB_TOKEN`環境変数（推奨）
2. `gh auth token`（GitHub CLIがインストールされている場合）

v1では、npmトークンは不要です（読み取り専用のレジストリクエリ）。

## ライブラリの使用方法

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

## セキュリティと脅威モデル

完全なセキュリティモデルについては、[SECURITY.md](./SECURITY.md)を参照してください。

**影響範囲:** 公開されているGitHub API（リポジトリのメタデータ、ファイルの内容、イシュー、プルリクエスト）と、公開されているnpmレジストリ（読み取り専用のパッケージメタデータ）。`apply --confirm`を使用する場合、書き込みアクセス権を持つリポジトリにイシューとプルリクエストを作成します。

**影響範囲外:** ローカルファイルは変更されません（読み取り専用の設定ファイル参照）。npmの公開、Dockerのプッシュ、認証情報の保存は行われません。データは、GitHub/npm APIへの呼び出し以外では、マシンから外部に送信されません。

**必要な権限:** `repo`スコープを持つGitHubトークン（監査には読み取り権限、`apply`には書き込み権限）。npmトークンは不要です。

**テレメトリーはありません。** 分析もありません。ホームへの接続もありません。あらゆる種類のデータ収集もありません。

---

<a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>によって作成されました。
