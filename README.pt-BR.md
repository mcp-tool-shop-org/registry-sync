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

Motor de sincronização de estado desejado para publicação de pacotes em vários registros. Audita sua organização GitHub em relação ao npmjs e ao GHCR, detecta desvios de versão, identifica pacotes órfãos e gera planos de ação — como o Terraform para registros de pacotes.

O complemento para operações de escrita de [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Instalação

```bash
npm install -g @mcptoolshop/registry-sync
```

Ou use diretamente:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## Guia de Início Rápido

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

Analisa todos os repositórios em uma organização GitHub, lê o `package.json` de cada repositório e verifica se há `Dockerfile`, e, em seguida, consulta o npmjs e o GHCR para criar uma matriz de presença.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

A saída mostra o status do desvio por registro:
- **✓** atual — a versão publicada corresponde ao repositório
- **⚠** atrasado — a versão do repositório está à frente da versão publicada
- **↓** à frente — a versão publicada está à frente do repositório (reversão ou correção urgente)
- **ausente** — ainda não foi publicado
- **○** órfão — publicado, mas não há repositório correspondente

### `plan`

Executa uma auditoria e gera um plano de ação com níveis de risco.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Tipos de ação:
- **publicar** — primeira publicação em um registro
- **atualizar** — é necessária uma atualização de versão (o repositório está à frente da versão publicada)
- **criar-fluxo-de-trabalho** — adicionar fluxo de trabalho de publicação de CI por meio de PR
- **limpar** — o pacote órfão precisa ser limpo

### `diff`

Compara dois instantâneos de auditoria para mostrar o que mudou entre as execuções — novo desvio, desvio resolvido, desvio agravado, novos/removidos repositórios e alterações de órfãos.

```
registry-sync diff --before audit-old.json --from audit-new.json [--format table|json|markdown]
```

Requer dois arquivos JSON de auditoria salvos anteriormente (de `registry-sync audit --json -o <file>`). Não são feitas novas chamadas de API — a diferença é puramente computacional sobre os dois instantâneos.

Tipos de alteração:
- **novo_desvio** — o repositório estava atual, agora está atrasado/ausente/à frente
- **resolvido** — havia um desvio, agora está atual
- **agravado** — o desvio se aprofundou (por exemplo, atrasado → ausente)
- **novo_repositório** / **repositório_removido** — repositório adicionado ou removido entre os instantâneos

### `apply`

Executa o plano. Todas as ações são não destrutivas em v1:
- Cria GitHub **issues** para ações de publicação/atualização/limpeza
- Abre GitHub **PRs** com arquivos de fluxo de trabalho de CI para ações de criação

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

Sem `--confirm`, mostra uma execução de teste (o mesmo que `plan`).

## Configuração

Coloque `registry-sync.config.json` na raiz do seu projeto:

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

Usa valores padrão razoáveis se nenhum arquivo de configuração for encontrado.

## Autenticação

Requer um token GitHub com escopo `repo`:

1. Variável de ambiente `GITHUB_TOKEN` (preferencial)
2. Alternativa `gh auth token` (se a CLI GitHub estiver instalada)

O token npm não é necessário em v1 (consultas de registro somente leitura).

## Uso da Biblioteca

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

## Segurança e Modelo de Ameaças

Consulte [SECURITY.md](./SECURITY.md) para obter o modelo de segurança completo.

**O que ele acessa:** API pública GitHub (metadados do repositório, conteúdo dos arquivos, issues, PRs) e o registro público do npm (metadados do pacote somente leitura). Cria issues e PRs nos repositórios nos quais você tem permissão de escrita quando `apply --confirm` é usado.

**O que ele NÃO acessa:** Nenhum arquivo local é modificado (consulta de configuração somente leitura). Nenhuma publicação no npm, nenhum envio para o Docker, nenhum armazenamento de credenciais. Nenhum dado sai da sua máquina além das chamadas de API GitHub/npm.

**Permissões necessárias:** Token GitHub com escopo `repo` (leitura para auditoria, escrita para aplicar). Nenhum token npm é necessário.

**Sem telemetria.** Sem análises. Sem comunicação com servidores externos. Sem coleta de dados de qualquer tipo.

---

Criado por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
