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

Moteur de synchronisation de l'état souhaité pour la publication de paquets dans plusieurs registres. Il analyse votre organisation GitHub par rapport à npmjs et GHCR, détecte les écarts de version, identifie les paquets orphelins et génère des plans d'action, un peu comme Terraform pour les registres de paquets.

La partie "écriture" complémentaire de [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Installation

```bash
npm install -g @mcptoolshop/registry-sync
```

Ou utilisez-le directement :

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

Analyse tous les dépôts d'une organisation GitHub, lit le fichier `package.json` de chaque dépôt et vérifie la présence d'un `Dockerfile`, puis interroge npmjs et GHCR pour créer une matrice de présence.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

La sortie affiche l'état de la synchronisation par registre :
- **✓** actuel — la version publiée correspond au dépôt
- **⚠** en retard — la version du dépôt est plus récente que la version publiée
- **manquant** — pas encore publié
- **○** orphelin — publié, mais aucun dépôt correspondant

### `plan`

Effectue une analyse et génère un plan d'action avec des niveaux de risque.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Types d'actions :
- **publish** — publication initiale dans un registre
- **update** — mise à jour de la version nécessaire (le dépôt est plus récent que la version publiée)
- **scaffold-workflow** — ajout d'un flux de travail de publication CI via une pull request
- **prune** — un paquet orphelin doit être supprimé

### `apply`

Exécute le plan. Toutes les actions sont non destructives en version 1 :
- Crée des **problèmes** GitHub pour les actions de publication/mise à jour/suppression
- Ouvre des **pull requests** GitHub avec les fichiers du flux de travail CI pour les actions de création de squelette

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

Sans l'option `--confirm`, effectue une simulation (comme `plan`).

## Configuration

Placez le fichier `registry-sync.config.json` à la racine de votre projet :

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

Utilise les valeurs par défaut si aucun fichier de configuration n'est trouvé.

## Authentification

Nécessite un jeton GitHub avec la portée `repo` :

1. Variable d'environnement `GITHUB_TOKEN` (préférée)
2. `gh auth token` (si l'interface de ligne de commande GitHub est installée)

Un jeton npm n'est pas requis en version 1 (requêtes de lecture seule du registre).

## Utilisation en tant que bibliothèque

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

## Sécurité et modèle de menace

Consultez [SECURITY.md](./SECURITY.md) pour le modèle de sécurité complet.

**Ce que cela touche :** API GitHub publique (métadonnées des dépôts, contenu des fichiers, problèmes, pull requests) et le registre npm public (métadonnées des paquets en lecture seule). Crée des problèmes et des pull requests sur les dépôts auxquels vous avez un accès en écriture lorsque `apply --confirm` est utilisé.

**Ce que cela NE touche PAS :** Aucun fichier local n'est modifié (lecture seule de la configuration). Aucune publication npm, aucun push Docker, aucun stockage d'informations d'identification. Aucune donnée ne quitte votre machine, à l'exception des appels aux API GitHub/npm.

**Autorisations requises :** Jeton GitHub avec la portée `repo` (lecture pour l'analyse, écriture pour l'application). Aucun jeton npm requis.

**Aucune télémétrie.** Aucune analyse. Aucune communication avec un serveur distant. Aucune collecte de données de quelque sorte que ce soit.

---

Créé par <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
