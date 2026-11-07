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

Motore di sincronizzazione dello stato desiderato per la pubblicazione di pacchetti in più repository. Esegue un controllo della tua organizzazione GitHub rispetto a npmjs e GHCR, rileva le discrepanze di versione, individua i pacchetti orfani e genera piani d'azione, come Terraform per i repository di pacchetti.

Il componente complementare per le operazioni di scrittura di [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Installazione

```bash
npm install -g @mcptoolshop/registry-sync
```

Oppure, utilizzalo direttamente:

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

Scansiona tutti i repository in un'organizzazione GitHub, legge il `package.json` di ciascun repository e verifica la presenza di `Dockerfile`, quindi interroga npmjs e GHCR per creare una matrice di presenza.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

L'output mostra lo stato delle discrepanze per ciascun repository:
- **✓** aggiornato: la versione pubblicata corrisponde al repository
- **⚠** indietro: la versione del repository è successiva a quella pubblicata
- **↓** avanti: la versione pubblicata è successiva a quella del repository (è necessario eseguire un rollback o una correzione rapida)
- **mancante**: non è ancora stato pubblicato
- **○** orfano: è stato pubblicato, ma non esiste un repository corrispondente

### `plan`

Esegue un controllo e genera un piano d'azione con livelli di rischio.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Tipi di azione:
- **publish**: prima pubblicazione in un repository
- **update**: è necessario aggiornare la versione (il repository è più recente della versione pubblicata)
- **scaffold-workflow**: aggiunge un flusso di lavoro di pubblicazione CI tramite PR
- **prune**: è necessario eliminare il pacchetto orfano

### `diff`

Confronta due istantanee di controllo per evidenziare le modifiche tra le esecuzioni: nuove discrepanze, discrepanze risolte, discrepanze aggravate, nuovi/rimossi repository e modifiche ai pacchetti orfani.

```
registry-sync diff --before audit-old.json --from audit-new.json [--format table|json|markdown]
```

Richiede due file JSON di controllo salvati in precedenza (da `registry-sync audit --json -o <file>`). Non vengono effettuate nuove chiamate API: il confronto è una semplice operazione sulle due istantanee.

Tipi di modifica:
- **new_drift**: il repository era aggiornato, ora è indietro/mancante/avanti
- **resolved**: era presente una discrepanza, ora è aggiornato
- **worsened**: la discrepanza è peggiorata (ad esempio, da indietro a mancante)
- **new_repo** / **removed_repo**: il repository è stato aggiunto o rimosso tra le istantanee

### `apply`

Esegue il piano. Tutte le azioni non sono distruttive in v1:
- Crea GitHub **issue** per le azioni di pubblicazione/aggiornamento/eliminazione
- Apre GitHub **PR** con file di flusso di lavoro CI per le azioni di scaffolding

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

Senza `--confirm`, mostra un'esecuzione di prova (come `plan`).

## Configurazione

Posiziona `registry-sync.config.json` nella directory principale del tuo progetto:

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

Se non viene trovato alcun file di configurazione, vengono utilizzati valori predefiniti appropriati.

## Autenticazione

Richiede un token GitHub con ambito `repo`:

1. Variabile d'ambiente `GITHUB_TOKEN` (preferibile)
2. Fallback `gh auth token` (se è installata la CLI GitHub)

Il token npm non è richiesto in v1 (interrogazioni di repository in sola lettura).

## Utilizzo della libreria

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

## Sicurezza e modello di minaccia

Consulta [SECURITY.md](./SECURITY.md) per il modello di sicurezza completo.

**Cosa interessa:** API pubblica GitHub (metadati del repository, contenuto dei file, issue, PR) e il repository npm pubblico (metadati dei pacchetti in sola lettura). Crea issue e PR nei repository a cui hai accesso in scrittura quando viene utilizzato `apply --confirm`.

**Cosa NON interessa:** Nessun file locale viene modificato (ricerca di configurazione in sola lettura). Nessuna pubblicazione npm, nessuna operazione di push su Docker, nessun archivio di credenziali. Nessun dato lascia la tua macchina oltre alle chiamate API GitHub/npm.

**Autorizzazioni richieste:** Token GitHub con ambito `repo` (lettura per il controllo, scrittura per l'applicazione). Non è necessario alcun token npm.

**Nessuna telemetria.** Nessuna analisi. Nessun invio di dati. Nessuna raccolta di dati di alcun tipo.

---

Creato da <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
