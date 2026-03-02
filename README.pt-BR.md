<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.md">English</a>
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

Motor de sincronização de estado desejado para a publicação de pacotes em múltiplos repositórios. Analisa sua organização no GitHub em relação ao npmjs e ao GHCR, detecta desvios de versão, encontra pacotes órfãos e gera planos de ação – como Terraform para repositórios de pacotes.

A ferramenta complementar para leitura, correspondente a [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Instalação

```bash
npm install -g @mcptoolshop/registry-sync
```

Ou use diretamente:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## Início Rápido

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

## Comandos

### `audit`

Analisa todos os repositórios em uma organização do GitHub, lê o arquivo `package.json` de cada repositório e verifica a existência de um `Dockerfile`, e então consulta o npmjs e o GHCR para criar uma matriz de presença.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

A saída mostra o status de desvio por repositório:
- **✓** atual — a versão publicada corresponde ao repositório
- **⚠** atrasado — a versão do repositório está à frente da versão publicada
- **ausente** — ainda não foi publicado
- **○** órfão — publicado, mas não há repositório correspondente

### `plan`

Executa uma análise e gera um plano de ação com níveis de risco.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Tipos de ação:
- **publish** — publicação inicial em um repositório
- **update** — atualização de versão necessária (repositório à frente da versão publicada)
- **scaffold-workflow** — adiciona um fluxo de trabalho de CI para publicação via pull request
- **prune** — pacote órfão precisa ser removido

### `apply`

Executa o plano. Todas as ações são não destrutivas na versão 1:
- Cria **issues** no GitHub para ações de publicação/atualização/remoção.
- Abre **pull requests** no GitHub com arquivos de fluxo de trabalho de CI para ações de criação de estrutura.

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

Sem a opção `--confirm`, exibe uma simulação (o mesmo que `plan`).

## Configuração

Coloque o arquivo `registry-sync.config.json` na raiz do seu projeto:

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

Utiliza configurações padrão se nenhum arquivo de configuração for encontrado.

## Autenticação

Requer um token do GitHub com o escopo `repo`:

1. Variável de ambiente `GITHUB_TOKEN` (preferível)
2. `gh auth token` (se a CLI do GitHub estiver instalada)

Um token npm não é necessário na versão 1 (consultas de leitura do repositório).

## Uso da Biblioteca

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

## Segurança e Modelo de Ameaças

Consulte [SECURITY.md](./SECURITY.md) para o modelo de segurança completo.

**O que ele acessa:** API pública do GitHub (metadados do repositório, conteúdo de arquivos, issues, pull requests) e o repositório público do npm (metadados de pacotes somente leitura). Cria issues e pull requests em repositórios aos quais você tem acesso de escrita quando a opção `apply --confirm` é usada.

**O que ele NÃO acessa:** Nenhum arquivo local é modificado (leitura de configuração). Não há publicação no npm, não há envio de imagens Docker, não há armazenamento de credenciais. Nenhum dado sai da sua máquina além das chamadas à API do GitHub/npm.

**Permissões necessárias:** Token do GitHub com o escopo `repo` (leitura para análise, escrita para execução). Não é necessário token do npm.

**Sem telemetria.** Sem análises. Sem envio de dados. Sem coleta de dados de qualquer tipo.

---

Desenvolvido por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a
