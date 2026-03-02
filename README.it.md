<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.md">English</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Motore di sincronizzazione dello stato desiderato per la pubblicazione di pacchetti su più registri. Verifica la tua organizzazione GitHub rispetto a npmjs e GHCR, rileva le discrepanze di versione, individua i pacchetti orfani e genera piani d'azione, come Terraform per i registri dei pacchetti.

La componente per la scrittura, complementare a [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Installazione

```bash
npm install -g @mcptoolshop/registry-sync
```

Oppure, utilizzala direttamente:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## Guida rapida

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

## Comandi

### `audit`

Scansiona tutti i repository in un'organizzazione GitHub, legge il file `package.json` di ogni repository e verifica la presenza di `Dockerfile`, quindi interroga npmjs e GHCR per creare una matrice di presenza.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

L'output mostra lo stato di sincronizzazione per ogni registro:
- **✓** current — la versione pubblicata corrisponde al repository
- **⚠** behind — la versione del repository è più recente della versione pubblicata
- **missing** — non ancora pubblicata
- **○** orphan — pubblicata, ma non esiste un repository corrispondente

### `plan`

Esegue un'analisi e genera un piano d'azione con livelli di rischio.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Tipi di azione:
- **publish** — pubblicazione iniziale su un registro
- **update** — è necessario aggiornare la versione (il repository è più recente della versione pubblicata)
- **scaffold-workflow** — aggiunge un flusso di lavoro di pubblicazione CI tramite pull request
- **prune** — il pacchetto orfano deve essere eliminato

### `apply`

Esegue il piano. Tutte le azioni sono non distruttive nella versione 1:
- Crea **issue** su GitHub per le azioni di pubblicazione/aggiornamento/eliminazione
- Apre **pull request** su GitHub con i file del flusso di lavoro CI per le azioni di scaffolding

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

Senza l'opzione `--confirm`, esegue una simulazione (equivalente a `plan`).

## Configurazione

Posiziona il file `registry-sync.config.json` nella directory principale del tuo progetto:

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

Se non viene trovato un file di configurazione, vengono utilizzati i valori predefiniti.

## Autenticazione

Richiede un token GitHub con l'ambito `repo`:

1. Variabile d'ambiente `GITHUB_TOKEN` (preferibile)
2. `gh auth token` (se è installato GitHub CLI)

Il token npm non è richiesto nella versione 1 (interrogazioni di sola lettura del registro).

## Utilizzo della libreria

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

## Sicurezza e modello di minaccia

Consulta il file [SECURITY.md](./SECURITY.md) per il modello di sicurezza completo.

**Cosa accede:** API pubblica di GitHub (metadati del repository, contenuto dei file, issue, pull request) e il registro pubblico npm (solo lettura dei metadati dei pacchetti). Crea issue e pull request sui repository a cui hai accesso in scrittura quando viene utilizzata l'opzione `apply --confirm`.

**Cosa NON accede:** Nessun file locale viene modificato (lettura della configurazione). Nessuna pubblicazione npm, nessuna esecuzione di Docker, nessun archivio di credenziali. Nessun dato lascia la tua macchina oltre alle chiamate API di GitHub/npm.

**Autorizzazioni richieste:** Token GitHub con l'ambito `repo` (lettura per l'analisi, scrittura per l'applicazione). Non è necessario un token npm.

**Nessuna telemetria.** Nessuna analisi. Nessuna trasmissione di dati. Nessuna raccolta di dati di alcun tipo.

---

Creato da <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
