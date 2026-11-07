<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.es.md">Español</a> | <a href="README.md">English</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Moteur de synchronisation de l’état souhaité pour la publication de paquets dans plusieurs registres. Il effectue un audit de votre organisation GitHub par rapport à npmjs et GHCR, détecte les dérives de version, identifie les paquets orphelins et génère des plans d’action, comme Terraform pour les registres de paquets.

L’outil complémentaire pour les opérations d’écriture de [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Installation

```bash
npm install -g @mcptoolshop/registry-sync
```

Ou utilisez-le directement :

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## Démarrage rapide

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

## Commandes

### `audit`

Analyse tous les dépôts d’une organisation GitHub, lit le `package.json` de chaque dépôt et vérifie la présence de `Dockerfile`, puis interroge npmjs et GHCR pour créer une matrice de présence.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

La sortie affiche l’état de la dérive par registre :
- **✓** à jour — la version publiée correspond au dépôt
- **⚠** en retard — la version du dépôt est plus récente que la version publiée
- **↓** en avance — la version publiée est plus récente que le dépôt (rétrogradation ou correctif rapide)
- **manquant** — pas encore publié
- **○** orphelin — publié, mais aucun dépôt correspondant

### `plan`

Effectue un audit et génère un plan d’action avec des niveaux de risque.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Types d’actions :
- **publish** — première publication dans un registre
- **update** — une mise à jour de version est nécessaire (le dépôt est plus récent que la version publiée)
- **scaffold-workflow** — ajout d’un flux de travail de publication CI via une demande d’extraction
- **prune** — un paquet orphelin doit être nettoyé

### `diff`

Compare deux instantanés d’audit pour identifier les changements entre les exécutions — nouvelle dérive, dérive résolue, dérive aggravée, nouveaux/supprimés dépôts et changements d’orphelins.

```
registry-sync diff --before audit-old.json --from audit-new.json [--format table|json|markdown]
```

Nécessite deux fichiers JSON d’audit précédemment enregistrés (à partir de `registry-sync audit --json -o <file>`). Aucune nouvelle requête d’API n’est effectuée — la comparaison est une simple opération sur les deux instantanés.

Types de changements :
- **new_drift** — le dépôt était à jour, maintenant en retard/manquant/en avance
- **resolved** — la dérive était présente, maintenant à jour
- **worsened** — la dérive s’est aggravée (par exemple, en retard → manquant)
- **new_repo** / **removed_repo** — un dépôt a été ajouté ou supprimé entre les instantanés

### `apply`

Exécute le plan. Toutes les actions sont non destructives dans v1 :
- Crée GitHub **tickets** pour les actions de publication/mise à jour/suppression
- Ouvre GitHub **demandes d’extraction** avec des fichiers de flux de travail CI pour les actions de création de modèle

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

Sans `--confirm`, affiche une exécution à blanc (comme `plan`).

## Configuration

Placez `registry-sync.config.json` dans le répertoire racine de votre projet :

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

Utilise des valeurs par défaut raisonnables si aucun fichier de configuration n’est trouvé.

## Authentification

Nécessite un jeton GitHub avec une portée `repo` :

1. Variable d’environnement `GITHUB_TOKEN` (préféré)
2. Solution de repli `gh auth token` (si l’outil en ligne de commande GitHub est installé)

Le jeton npm n’est pas requis dans v1 (requêtes de registre en lecture seule).

## Utilisation en tant que bibliothèque

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

## Sécurité et modèle de menace

Consultez le fichier [SECURITY.md](./SECURITY.md) pour obtenir le modèle de sécurité complet.

**Ce que cela affecte :** API publique GitHub (métadonnées du dépôt, contenu des fichiers, tickets, demandes d’extraction) et le registre npm public (métadonnées des paquets en lecture seule). Crée des tickets et des demandes d’extraction sur les dépôts auxquels vous avez accès en écriture lorsque `apply --confirm` est utilisé.

**Ce que cela n’affecte PAS :** Aucun fichier local n’est modifié (recherche de configuration en lecture seule). Aucune publication npm, aucun envoi Docker, aucun stockage d’informations d’identification. Aucune donnée ne quitte votre machine au-delà des requêtes d’API GitHub/npm.

**Autorisations requises :** jeton GitHub avec une portée `repo` (lecture pour l’audit, écriture pour l’application). Aucun jeton npm n’est requis.

**Aucune télémétrie.** Pas d’analyse. Pas de communication vers le domicile. Aucune collecte de données de quelque nature que ce soit.

---

Créé par <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
