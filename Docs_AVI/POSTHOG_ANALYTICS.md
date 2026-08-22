# 📊 PostHog Analytics - AVI

**Proyecto PostHog:** 199238 · **Host:** `https://us.i.posthog.com`

Este documento describe cómo LibreChat-AVI envía datos a PostHog, qué propiedades se registran, cómo separar los datos por entorno y cómo verificar que todo funciona.

---

## 📋 Tabla de Contenidos

- [Contrato de propiedades](#contrato-de-propiedades)
- [Arquitectura](#arquitectura)
- [Entornos](#entornos)
- [Separación de datos por entorno](#separación-de-datos-por-entorno)
- [Gotchas operativos](#gotchas-operativos)
- [Cómo agregar nuevos eventos](#cómo-agregar-nuevos-eventos)
- [Verificación](#verificación)
- [MCP de PostHog](#mcp-de-posthog)

---

## Contrato de propiedades

⚠️ **Estos nombres son un contrato. Renombrarlos rompe todos los insights y cohorts ya creados en PostHog.** Si necesitas un dato nuevo, agrega una propiedad; no renombres las existentes.

| Propiedad | Origen (`TUser`) | Campo en MongoDB | Valores |
|---|---|---|---|
| `avi_rol` | `user.aviRol` | `aviRol_id` → `avirols.name` | `Residencia`, `FAE` |
| `avi_subrol` | `user.aviSubrol` | `aviSubrol_id` → `avisubrols.name` | `Educador de Trato Directo (ETD)`, `Familias Extensas`, … |
| `avi_rango_edad` | `user.ageRange` | `ageRange` | `18 a 24`, `25 a 34`, `35 a 44`, `45 a 54`, `55 a 64`, `65 o más años` |
| `avi_region` | `user.region` | `region` | Región declarada en el registro |

**Convención `'sin_dato'`**: cuando el usuario no tiene el campo (p. ej. no eligió sub-rol), se envía el string literal `'sin_dato'` en vez de `null`/`undefined`. Esto evita tener que usar el filtro "is not set" en cada insight y mantiene los breakdowns completos.

**`distinct_id`** = `user.id` (el `_id` de MongoDB). **No** se envía email ni nombre: son PII innecesaria para segmentar.

Los valores de rango de edad están definidos en `client/src/components/Auth/Registration.tsx` (`AGE_RANGE_OPTIONS`). Los roles y sub-roles se definen en `librechat.yaml` (sección `aviRoles`) y se sincronizan a MongoDB — ver [`AVI_ROLES.md`](./AVI_ROLES.md).

---

## Arquitectura

### Por qué `identify()` **y** `register()`

Las propiedades se emiten **por partida doble**, y esto es intencional:

| Llamada | Qué hace | Para qué sirve |
|---|---|---|
| `posthog.identify(id, props)` | Setea **person properties** (`$set`) | Filtrar Personas y construir Cohorts |
| `posthog.register(props)` | Setea **super properties** | Filtrar y hacer *breakdown* de **EVENTOS** |

**Sin `register()` no se puede segmentar eventos por rol.** PostHog no almacena `$set` dentro de los eventos: solo actualiza el perfil de la persona. Las super properties, en cambio, se adjuntan a cada evento que se envía.

### Flujo

```
api/server/controllers/UserController.js
  └─ attachAviRoleNames()  → resuelve aviRol_id/aviSubrol_id a NOMBRES
     └─ GET /api/user devuelve { aviRol, aviSubrol, ageRange, region, ... }
        │
client/src/Providers/PostHogProvider.tsx   (montado en App.jsx)
  └─ fetch('/api/config') → posthogKey/posthogHost
     └─ posthog.init() explícito → publica el cliente en el contexto
        │
client/src/routes/index.tsx → AuthLayout
  └─ <PostHogIdentify />   (dentro de AuthContextProvider)
     └─ usePostHogIdentify()
        ├─ identify(user.id, props)
        ├─ register(props)
        └─ reset()  ← al cerrar sesión
```

### Piezas

| Archivo | Rol |
|---|---|
| `api/server/controllers/UserController.js` | `attachAviRoleNames()` resuelve los ObjectId de rol/sub-rol a sus nombres. Solo proyecta `name` — `knowledge`/`behavior`/`registerAnswer` son bloques de prompt de hasta 10.000 caracteres y **nunca** deben viajar al cliente |
| `api/server/routes/config.js` | Expone `posthogKey`/`posthogHost` desde las env vars |
| `client/src/Providers/PostHogProvider.tsx` | Lee la config e inicializa el SDK |
| `client/src/hooks/Analytics/usePostHogIdentify.ts` | Sincroniza la identidad AVI (identify + register + reset) |
| `client/src/components/Analytics/PostHogIdentify.tsx` | Componente sin UI que monta el hook (mismo patrón que `ApiErrorWatcher`) |

### Por qué `<PostHogIdentify />` va en `AuthLayout`

Es el único punto del árbol que está simultáneamente **dentro de `AuthContextProvider`** (acceso a `user`) y **dentro de `PostHogProvider`** (que envuelve al `RouterProvider` en `App.jsx`). Además `/login` vive dentro de `AuthLayout`, así que el componente **no se desmonta al cerrar sesión** y sí observa la transición `user → undefined` que dispara el `reset()`.

### Init explícito (no delegado a `PHProvider`)

`PHProvider` de `posthog-js/react` llama a `init()` dentro de un `useEffect` propio. Como los efectos de React corren *bottom-up*, un componente hijo podría llamar `identify()` **antes** del init — y **posthog-js no encola esas llamadas: se pierden en silencio**.

Por eso el provider hace `posthog.init()` él mismo y pasa `client={client}` a `PHProvider` (que al recibir `client` no vuelve a inicializar). El contexto publica el cliente **solo tras el init**, así que `usePostHog()` devuelve `null` hasta que sea seguro usarlo.

---

## Entornos

| Entorno | Frontend | Backend | Notas |
|---|---|---|---|
| Local dev | `http://localhost:3090` (Vite) | `http://localhost:3080` | Vite proxea `/api` → 3080 (`client/vite.config.ts`) |
| Local build | `http://localhost:3080` | mismo | `DOMAIN_CLIENT`/`DOMAIN_SERVER` del `.env` |
| Dev remoto | `https://avi-dev.corporacionccm.cl` | mismo | |
| Producción | `https://avi.corporacionccm.cl` | mismo | |

### Variables de entorno

```env
POSTHOG_API_KEY=phc_xxxxxxxx
POSTHOG_HOST=https://us.i.posthog.com
```

✅ **La key se lee en RUNTIME desde `/api/config`, no en build-time.** Por lo tanto **no hay que rebuildear la imagen Docker por entorno** — basta con el `.env` de cada uno.

Las variantes `VITE_PUBLIC_POSTHOG_KEY` / `VITE_PUBLIC_POSTHOG_HOST` del `.env` **solo se usan en tests** (`client/test/layout-test-utils.tsx`) y son irrelevantes en despliegue.

---

## Separación de datos por entorno

Los tres entornos comparten el mismo proyecto de PostHog (199238). La separación se hace **filtrando por dominio en la interfaz de PostHog**, usando la propiedad automática `$host`:

| Entorno | Filtro |
|---|---|
| Local | `$host = localhost:3090` |
| Dev | `$host = avi-dev.corporacionccm.cl` |
| Producción | `$host = avi.corporacionccm.cl` |

Guarda tus insights de producción **con ese filtro aplicado** para que las pruebas locales no los alteren.

⚠️ **Matiz**: el filtro por `$host` aplica a **eventos**. Los cohorts basados en *person properties* no llevan dominio. En la práctica no se solapan, porque cada entorno tiene su propio MongoDB y por tanto los `distinct_id` (ObjectId) son distintos entre entornos.

---

## Gotchas operativos

1. **`/api/config` se cachea** (`api/server/routes/config.js`, `CacheKeys.STARTUP_CONFIG`). Tras cambiar `POSTHOG_API_KEY` o `POSTHOG_HOST` hay que **reiniciar el backend**. Si el cache store es Redis, además hay que vaciar esa key.

2. **`posthog.reset()` en logout es obligatorio.** Las super properties persisten en `localStorage`; sin el reset, el siguiente usuario del mismo navegador heredaría el `avi_rol` del anterior. Ya está implementado en `usePostHogIdentify`.

3. **Las person properties tardan unos segundos en indexarse** y solo aparecen en el buscador de propiedades de PostHog tras el primer evento que las contenga.

4. **Los nombres de rol son el valor de segmentación.** Si un admin renombra un rol en `librechat.yaml` y sincroniza, los insights históricos quedarán partidos entre el nombre viejo y el nuevo.

---

## Cómo agregar nuevos eventos

```tsx
import { usePostHog } from '~/Providers/PostHogProvider';

const MiComponente = () => {
  const posthog = usePostHog();

  const handleClick = () => {
    posthog?.capture('avi_mi_evento', { alguna_propiedad: 'valor' });
  };
};
```

Dos reglas:

- **Importa `usePostHog` desde `~/Providers/PostHogProvider`**, ⚠️ **nunca** desde `posthog-js/react`. El de la librería devuelve el singleton global aunque no esté inicializado, anulando el guard y perdiendo eventos en silencio.
- **Siempre con guard** (`posthog?.` o `if (!posthog) return`). Devuelve `null` cuando PostHog no está configurado o aún no terminó de inicializar.

No hace falta pasar `avi_rol` ni las demás propiedades AVI: al estar registradas como super properties, se adjuntan automáticamente a cada evento.

---

## Verificación

### Fase 1 — Local dev (validar todo aquí primero)

```bash
docker-compose -f deploy-compose-dev.yml up -d
npm run backend:dev
npm run frontend:dev
```

Navegar a `http://localhost:3090` e iniciar sesión.

**1. Backend** — DevTools → Network → `GET /api/user`:
```json
{ "id": "...", "aviRol": "Residencia", "aviSubrol": "Familias Extensas",
  "ageRange": "25 a 34", "region": "Metropolitana de Santiago" }
```
Confirmar que **NO** aparecen `knowledge`, `behavior` ni `registerAnswer`.

**2. Cliente** — consola del navegador:
```js
posthog.get_distinct_id()        // el _id de Mongo, no un UUID anónimo
posthog.get_property('avi_rol')  // 'Residencia'
posthog.persistence.props        // debe contener las 4 propiedades avi_*
```

**3. Montaje único** — la consola **no** debe mostrar `[PostHog.js] posthog was already loaded elsewhere`, y en Network debe haber **una sola** petición a `/api/config`.

**4. Logout** — `posthog.get_distinct_id()` debe cambiar a un id anónimo nuevo y `posthog.get_property('avi_rol')` debe ser `undefined`.

**5. Dashboard PostHog** (filtrando `$host = localhost:3090`):
- **Activity → Live events**: aparece `$identify`. Abrir cualquier `$pageview` → *Properties* → deben figurar las 4 `avi_*` (confirma `register()`).
- **People → Persons**: buscar el `distinct_id` → *Properties* → mismas 4 claves (confirma `identify()`).
- **Prueba real**: New insight → Trends → `$pageview` → *Breakdown by* → Event property → `avi_rol`. Debe partir en `Residencia` / `FAE`.

### Fase 2 — Dev remoto

Desplegar a `https://avi-dev.corporacionccm.cl` y repetir los pasos 1-5 filtrando por ese `$host`. Confirmar que `POSTHOG_API_KEY` está definido en el `.env` del entorno y que el backend se reinició.

### Fase 3 — Producción

Solo tras validar la fase 2. Verificación mínima: un login real → `$identify` visible en Live events con `$host = avi.corporacionccm.cl` y las 4 propiedades `avi_*` presentes.

---

## MCP de PostHog

El MCP permite consultar insights, feature flags y errores de PostHog desde Claude Code. **No instrumenta código** — es una herramienta de análisis y verificación.

Instalación a nivel de proyecto (crea `.mcp.json` en la raíz, versionable en git):

```bash
claude mcp add --transport http --scope project posthog https://mcp.posthog.com/mcp
```

```json
{
  "mcpServers": {
    "posthog": {
      "type": "http",
      "url": "https://mcp.posthog.com/mcp"
    }
  }
}
```

**Es seguro commitear `.mcp.json`**: la autenticación es OAuth por usuario y el token se guarda en el credential store del SO, no en el archivo. Cada miembro del equipo aprueba el servidor y se autentica por su cuenta con `/mcp` en su primera sesión. Requiere reiniciar Claude Code tras crear el archivo.

---

## Referencias

- [`AVI_ROLES.md`](./AVI_ROLES.md) — roles y sub-roles AVI, schema y sincronización
- [`GUIA_DEPLOY_DESARROLLO.md`](./GUIA_DEPLOY_DESARROLLO.md) — despliegue y entornos
- [`CHANGELOG_AVI.md`](./CHANGELOG_AVI.md) — historial de cambios del fork
- [PostHog · Person properties](https://posthog.com/docs/product-analytics/person-properties)
- [PostHog · MCP para Claude Code](https://posthog.com/docs/model-context-protocol/claude-code)
