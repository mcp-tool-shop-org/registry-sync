<p align="center">
  <a href="README.ja.md">日本語</a> | <a href="README.zh.md">中文</a> | <a href="README.md">English</a> | <a href="README.fr.md">Français</a> | <a href="README.hi.md">हिन्दी</a> | <a href="README.it.md">Italiano</a> | <a href="README.pt-BR.md">Português (BR)</a>
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

Motor de sincronización de estado deseado para la publicación de paquetes en múltiples registros. Audita su organización de GitHub frente a npmjs y GHCR, detecta desviaciones de versión, encuentra paquetes huérfanos y genera planes de acción, como Terraform para registros de paquetes.

La herramienta complementaria de escritura para [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Instalación

```bash
npm install -g @mcptoolshop/registry-sync
```

O úselo directamente:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## Inicio rápido

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

Escanea todos los repositorios en una organización de GitHub, lee el archivo `package.json` de cada repositorio y verifica la presencia de `Dockerfile`, y luego consulta npmjs y GHCR para crear una matriz de presencia.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

La salida muestra el estado de la desviación por registro:
- **✓** current — la versión publicada coincide con el repositorio
- **⚠** behind — la versión del repositorio está por delante de la publicada
- **missing** — aún no se ha publicado
- **○** orphan — publicado pero no hay un repositorio correspondiente

### `plan`

Ejecuta una auditoría y genera un plan de acción con niveles de riesgo.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Tipos de acción:
- **publish** — publicación inicial en un registro
- **update** — se necesita un aumento de versión (el repositorio está por delante de la versión publicada)
- **scaffold-workflow** — agrega un flujo de trabajo de publicación de CI a través de una solicitud de extracción
- **prune** — el paquete huérfano necesita limpieza

### `apply`

Ejecuta el plan. Todas las acciones son no destructivas en la versión 1:
- Crea **problemas** de GitHub para las acciones de publicación/actualización/limpieza
- Abre **solicitudes de extracción** de GitHub con archivos de flujo de trabajo de CI para las acciones de creación de estructura

```
registry-sync apply --confirm [--target npmjs|ghcr|all]
```

Sin `--confirm`, muestra una ejecución de prueba (igual que `plan`).

## Configuración

Coloque `registry-sync.config.json` en la raíz de su proyecto:

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

Utiliza valores predeterminados si no se encuentra ningún archivo de configuración.

## Autenticación

Requiere un token de GitHub con el alcance `repo`:

1. Variable de entorno `GITHUB_TOKEN` (preferido)
2. `gh auth token` (si está instalado el CLI de GitHub)

No se requiere un token de npm en la versión 1 (consultas de solo lectura al registro).

## Uso de la biblioteca

```typescript
import { audit, plan, loadConfig } from '@mcptoolshop/registry-sync';

const config = loadConfig();
const auditResult = await audit(config);
const planResult = plan(auditResult, config);

console.log(planResult.summary);
// { publish: 9, update: 1, scaffold: 26, prune: 3, skip: 45 }
```

## Seguridad y modelo de amenazas

Consulte [SECURITY.md](./SECURITY.md) para obtener el modelo de seguridad completo.

**Lo que afecta:** API pública de GitHub (metadatos del repositorio, contenido de archivos, problemas, solicitudes de extracción) y el registro público de npm (metadatos de paquetes de solo lectura). Crea problemas y solicitudes de extracción en los repositorios a los que tiene acceso de escritura cuando se utiliza `apply --confirm`.

**Lo que NO afecta:** No se modifican archivos locales (búsqueda de configuración de solo lectura). No se realiza la publicación en npm, ni se envía ninguna imagen Docker, ni se almacenan credenciales. Ningún dato sale de su máquina más allá de las llamadas a las API de GitHub/npm.

**Permisos requeridos:** Token de GitHub con el alcance `repo` (lectura para la auditoría, escritura para la aplicación). No se necesita token de npm.

**Sin telemetría.** Sin análisis. Sin comunicación con servidores externos. Sin recopilación de datos de ningún tipo.

---

Desarrollado por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
