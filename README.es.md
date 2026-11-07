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

Motor de sincronización de estado deseado para la publicación de paquetes en múltiples registros. Realiza auditorías de su organización GitHub en npmjs y GHCR, detecta desviaciones de versión, identifica paquetes huérfanos y genera planes de acción, como Terraform para los registros de paquetes.

El complemento de escritura para [`registry-stats`](https://github.com/mcp-tool-shop-org/registry-stats).

## Instalación

```bash
npm install -g @mcptoolshop/registry-sync
```

O úselo directamente:

```bash
npx @mcptoolshop/registry-sync audit --org my-org
```

## Guía de inicio rápido

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

Analiza todos los repositorios en una organización GitHub, lee el `package.json` de cada repositorio y verifica si hay `Dockerfile`, luego consulta npmjs y GHCR para crear una matriz de presencia.

```
registry-sync audit [--org <org>] [--format table|json|markdown]
```

La salida muestra el estado de la desviación por registro:
- **✓** actual: la versión publicada coincide con el repositorio
- **⚠** rezagado: la versión del repositorio está por delante de la publicada
- **↓** adelantado: la versión publicada está por delante del repositorio (retroceso o corrección urgente)
- **faltante**: aún no se ha publicado
- **○** huérfano: se ha publicado, pero no hay un repositorio correspondiente

### `plan`

Ejecuta una auditoría y genera un plan de acción con niveles de riesgo.

```
registry-sync plan [--org <org>] [--target npmjs|ghcr|all]
```

Tipos de acción:
- **publicar**: primera publicación en un registro
- **actualizar**: se necesita una actualización de versión (el repositorio está por delante de la versión publicada)
- **crear-flujo_de_trabajo**: agregar un flujo de trabajo de publicación de CI a través de una solicitud de extracción
- **eliminar**: el paquete huérfano necesita limpieza

### `diff`

Compara dos instantáneas de auditoría para mostrar qué cambió entre las ejecuciones: nueva desviación, desviación resuelta, desviación empeorada, nuevos/eliminados repositorios y cambios en los paquetes huérfanos.

```
registry-sync diff --before audit-old.json --from audit-new.json [--format table|json|markdown]
```

Requiere dos archivos JSON de auditoría guardados previamente (de `registry-sync audit --json -o <file>`). No se realizan nuevas llamadas a la API; la diferencia es un cálculo puro sobre las dos instantáneas.

Tipos de cambio:
- **nueva_desviación**: el repositorio estaba actualizado, ahora está rezagado/faltante/adelantado
- **resuelto**: la desviación estaba presente, ahora está actualizado
- **empeorado**: la desviación se agravó (por ejemplo, rezagado → faltante)
- **nuevo_repositorio** / **repositorio_eliminado**: se agregó o eliminó un repositorio entre las instantáneas

### `apply`

Ejecuta el plan. Todas las acciones son no destructivas en v1:
- Crea GitHub **incidencias** para las acciones de publicación/actualización/eliminación
- Abre GitHub **solicitudes de extracción** con archivos de flujo de trabajo de CI para las acciones de creación

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

Si no se encuentra ningún archivo de configuración, se utilizarán valores predeterminados razonables.

## Autenticación

Requiere un token GitHub con el ámbito `repo`:

1. Variable de entorno `GITHUB_TOKEN` (preferido)
2. Alternativa `gh auth token` (si la CLI GitHub está instalada)

No se requiere un token de npm en v1 (consultas de registro de solo lectura).

## Uso de la biblioteca

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

## Seguridad y modelo de amenazas

Consulte [SECURITY.md](./SECURITY.md) para obtener el modelo de seguridad completo.

**Qué afecta:** API pública GitHub (metadatos del repositorio, contenido de los archivos, incidencias, solicitudes de extracción) y el registro público de npm (metadatos del paquete de solo lectura). Crea incidencias y solicitudes de extracción en los repositorios en los que tiene permisos de escritura cuando se utiliza `apply --confirm`.

**Qué NO afecta:** No se modifican archivos locales (búsqueda de configuración de solo lectura). No se realiza ninguna publicación en npm, ni ninguna carga en Docker, ni se almacena ninguna credencial. No se envían datos fuera de su máquina más allá de las llamadas a la API GitHub/npm.

**Permisos requeridos:** Token GitHub con el ámbito `repo` (lectura para la auditoría, escritura para la aplicación). No se necesita un token de npm.

**No hay telemetría.** No hay análisis. No hay comunicación con el servidor. No se recopilan datos de ningún tipo.

---

Creado por <a href="https://mcp-tool-shop.github.io/">MCP Tool Shop</a>
