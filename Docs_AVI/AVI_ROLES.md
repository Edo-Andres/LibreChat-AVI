# 🎭 Sistema AVI Roles - Referencia Canónica

**Validado contra código:** Junio 2026 (rama `dev`)
**Proyecto:** LibreChat-AVI - Asistente Virtual en Infancia

---

## 📋 Tabla de Contenidos

1. [Visión General](#visión-general)
2. [Modelo de Datos](#modelo-de-datos)
3. [Roles Actuales en `librechat.yaml`](#roles-actuales-en-librechatyaml)
4. [Campos `knowledge`, `behavior` y `registerAnswer`](#campos-knowledge-behavior-y-registeranswer)
5. [Variables de Plantilla en Prompts](#variables-de-plantilla-en-prompts)
6. [Sugerencias Iniciales (`initial_suggestions`)](#sugerencias-iniciales-initial_suggestions)
7. [Recarga Dinámica de Roles](#recarga-dinámica-de-roles)
8. [Migración y Renombrado](#migración-y-renombrado)
9. [API de Métodos](#api-de-métodos)
10. [Notas y Advertencias](#notas-y-advertencias)

---

## Visión General

El sistema AVI Roles implementa un esquema jerárquico de **roles** y **subroles** para usuarios del proyecto AVI. Coexiste con el sistema de roles nativo de LibreChat (`ADMIN`, `USER`) sin reemplazarlo.

Cada rol/subrol puede definir:
- **`knowledge`**: perfil de conocimientos inyectado en el prompt del agente.
- **`behavior`**: estilo/comportamiento esperado inyectado en el prompt.
- **`registerAnswer`**: etiqueta mostrada en el formulario de registro.
- **`initial_suggestions`**: sugerencias iniciales por rol (en MongoDB, no en YAML).

Los roles se configuran en `librechat.yaml` (sección `aviRoles`) y se sincronizan a MongoDB mediante scripts de migración.

---

## Modelo de Datos

### Colecciones MongoDB

#### `avirols`

Definición: `packages/data-schemas/src/schema/aviRol.ts`

| Campo | Tipo | Requerido | Único | Índice | Default | Restricciones |
|---|---|---|---|---|---|---|
| `name` | String | ✅ | ✅ | ✅ | — | `trim: true` |
| `knowledge` | String | — | — | — | `null` | `maxlength: 10000`, `trim` |
| `behavior` | String | — | — | — | `null` | `maxlength: 10000`, `trim` |
| `initial_suggestions` | [String] | — | — | — | `[]` | máx 4 entradas |
| `registerAnswer` | String | — | — | — | `null` | `maxlength: 10000`, `trim` |
| `createdAt` | Date | — | — | — | auto | `{ timestamps: true }` |
| `updatedAt` | Date | — | — | — | auto | `{ timestamps: true }` |

Índice adicional: `aviRolSchema.index({ name: 1 })`.

#### `avisubrols`

Definición: `packages/data-schemas/src/schema/aviSubrol.ts`

| Campo | Tipo | Requerido | Único | Índice | Default | Restricciones |
|---|---|---|---|---|---|---|
| `name` | String | ✅ | (compuesto) | — | — | `trim: true` |
| `parentRolId` | ObjectId → `AviRol` | ✅ | — | ✅ | — | `ref: 'AviRol'` |
| `knowledge` | String | — | — | — | `null` | `maxlength: 10000`, `trim` |
| `behavior` | String | — | — | — | `null` | `maxlength: 10000`, `trim` |
| `initial_suggestions` | [String] | — | — | — | `[]` | máx 4 entradas |
| `registerAnswer` | String | — | — | — | `null` | `maxlength: 10000`, `trim` |
| `createdAt` | Date | — | — | — | auto | `{ timestamps: true }` |
| `updatedAt` | Date | — | — | — | auto | `{ timestamps: true }` |

Índices:
- **Compuesto único**: `{ name: 1, parentRolId: 1 }` → el nombre del subrol es único **dentro de un mismo rol padre**.
- `{ parentRolId: 1 }` → búsqueda por rol padre.

> **Nota:** `name` por sí solo **no** es único en `aviSubrol`. La unicidad es conjunta con `parentRolId`, por lo que pueden existir subroles con el mismo nombre bajo distintos roles.

#### `users` (campos AVI añadidos)

Definición: `packages/data-schemas/src/schema/user.ts:73-84`

| Campo | Tipo | Requerido | Índice | Referencia |
|---|---|---|---|---|
| `aviRol_id` | ObjectId | — | ✅ | `AviRol` |
| `aviSubrol_id` | ObjectId | — | ✅ | `AviSubrol` |

Ambos opcionales. Interfaces TypeScript: `IUser` (`packages/data-schemas/src/types/user.ts:14-15`).

### Tipos TypeScript

- `IAviRol`: `packages/data-schemas/src/types/aviRol.ts:4-13`
- `IAviSubrol`: `packages/data-schemas/src/types/aviSubrol.ts:4-14`
- `TAviRol` / `TAviSubrol` (provider): `packages/data-provider/src/types/aviRoles.ts`

---

## Roles Actuales en `librechat.yaml`

Ubicación: `librechat.yaml:96-500`. Validación Zod: `packages/data-provider/src/config.ts:808-833`.

### Estructura YAML

```yaml
aviRoles:
  roles:
    - name: "<nombre>"
      knowledge: "<texto multilinea>"
      behavior: "<texto>"
      registerAnswer: "<etiqueta form registro>"
      subroles:
        - name: "<nombre subrol>"
          knowledge: "<texto>"
          behavior: "<texto>"
          registerAnswer: "<etiqueta>"
  migrations:
    roles: {}           # mapeo renombrado: { "viejo": "nuevo" }
    subroles: {}        # mapeo renombrado: { "viejo": "nuevo" | null }
    defaultRoleForOrphans: "<nombre>"
```

> El formato de subroles acepta **string** (legacy) u **objeto** `{ name, knowledge, behavior, registerAnswer }` (actual). La normalización corre en `config/avi-roles-config.js:129-158` (`normalizeSubroles`).

### Roles definidos actualmente

| Rol | Subroles | `registerAnswer` |
|---|---|---|
| **`Residencia`** | Director Ejecutivo Organización, Director Social o similar, Director de residencia, Trabajador Social de Dupla Psicosocial, Psicólogo de Dupla Psicosocial, Educador de Trato Directo (ETD), Encargado de vida familiar, Terapeuta Ocupacional, Pedagoga/o o psicopedagoga/o, Administrativa/o, Servicio de mantención, Manipuladora de alimentos, Guardia, Estudiante, Docente, Psiquiatra, Investigador, Voluntaria/o | `"Residencia"` |
| **`FAE`** | Familias Extensas, Familias Externas, Equipo | `"FAE"` |

> **El fallback `DEFAULT_CONFIG`** en `config/avi-roles-config.js:20-40` define `generico`/`cuidador`/`administrativo`, pero **solo se usa si el YAML no existe**. En producción/staging los roles reales son `Residencia` y `FAE`.

---

## Campos `knowledge`, `behavior` y `registerAnswer`

### `knowledge` y `behavior` — Inyección en prompts

**Dónde se inyectan:** `api/server/services/Endpoints/agents/agent.js:185-216` (`initializeAgent`).

Flujo:
1. Si el usuario tiene `aviRol_id` o `aviSubrol_id`, se llama `getUserWithAviRoles(req.user.id)` (`packages/data-schemas/src/methods/user.ts:329-335`), que popula `aviRol_id`/`aviSubrol_id` con `name knowledge behavior registerAnswer`.
2. Los valores se copian al objeto `userWithRoles` como `aviRolKnowledge`, `aviRolBehavior`, `aviSubrolKnowledge`, `aviSubrolBehavior`, `aviRolRegisterAnswer`, `aviSubrolRegisterAnswer`.
3. `replaceSpecialVars({ text: agent.instructions, user: userWithRoles })` reemplaza las variables de plantilla en las instrucciones del agente (ver sección siguiente).
4. La inyección ocurre **solo en el endpoint Agents** (system prompt del agente).

### `registerAnswer` — Etiqueta del formulario de registro

**Dónde se usa:** `client/src/components/Auth/Registration.tsx:348` y `:373`.

```tsx
// Rol (L348)
{role.registerAnswer || role.name}
// Subrol (L373)
{subrol.registerAnswer || subrol.name}
```

`registerAnswer` es la **etiqueta visible** por el usuario en el dropdown del formulario de registro. Si no está definido, se muestra `name`. Útil para mostrar textos más amables que el nombre interno.

---

## Variables de Plantilla en Prompts

Definición: `packages/data-provider/src/config.ts:1721-1734` (`specialVariables`).
Reemplazo: `packages/data-provider/src/parsers.ts:413-491` (`replaceSpecialVars`).

### Lista completa (8 variables)

Escribir en el `instructions` del agente (case-insensitive):

| Variable | Se reemplaza por | Fallback si no hay rol |
|---|---|---|
| `{{user_avi_rol}}` | nombre del rol del usuario | `''` |
| `{{user_avi_subrol}}` | nombre del subrol del usuario | `''` |
| `{{user_avi_rol_knowledge}}` | `knowledge` del rol | `''` |
| `{{user_avi_rol_behavior}}` | `behavior` del rol | `''` |
| `{{user_avi_subrol_knowledge}}` | `knowledge` del subrol | `''` |
| `{{user_avi_subrol_behavior}}` | `behavior` del subrol | `''` |
| `{{user_avi_rol_registerAnswer}}` | `registerAnswer` del rol | `''` |
| `{{user_avi_subrol_registerAnswer}}` | `registerAnswer` del subrol | `''` |

Variables no-AVI también soportadas en la misma función: `{{current_date}}`, `{{current_datetime}}`, `{{iso_datetime}}`, `{{current_user}}`.

### Ejemplo de uso en `librechat.yaml`

El `knowledge` del rol `Residencia` usa `{{user_avi_rol}}` como autorreferencia dentro de su propio texto de perfil:

```yaml
knowledge: |
  Actúas como AVI para el rol {{user_avi_rol}}.
  ...
```

---

## Sugerencias Iniciales (`initial_suggestions`)

### Almacenamiento

- **`defaultInitialSuggestions`**: en `librechat.yaml` (`conversationSuggestions.defaultInitialSuggestions`, máx 4). Servido vía `/api/config`.
- **`initial_suggestions` por rol/subrol**: **solo en MongoDB** (campos del schema `aviRol`/`aviSubrol`). **No se definen en YAML** — el schema Zod de `aviRoles` no las incluye, por lo que cualquier valor en YAML se descarta al parsear.

### Carga (prioridad)

Ruta: `GET /api/suggestions/initial` → `api/server/routes/suggestions.js:15-47`.

```
aviSubrol.initial_suggestions  →  aviRol.initial_suggestions  →  config.conversationSuggestions.defaultInitialSuggestions
```

Máximo 4 sugerencias. El cliente (`client/src/components/Chat/Input/InitialSuggestions.tsx`) consulta la API con `staleTime` 5 min y usa el default del config como fallback de render.

### Cómo editarlas

| Tipo | Dónde editar | Requiere reload |
|---|---|---|
| Default global | `librechat.yaml` → `conversationSuggestions.defaultInitialSuggestions` | Stop + redeploy en Dokploy |
| Por rol / subrol | Directo en MongoDB (`avirols` / `avisubrols`) | No (se lee en runtime) |

> El script `reload-avi-roles.sh` **NO** sincroniza `initial_suggestions` desde el YAML.

---

## Recarga Dinámica de Roles

Existen **dos rutas** para sincronizar cambios en `librechat.yaml` hacia MongoDB. Difieren en capacidad.

### Ruta A — Docker (script oficial completo)

```bash
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"
# Sin confirmación interactiva:
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh"
```

- Script: `scripts/reload-avi-roles.sh` (120 líneas).
- Lógica: reutiliza `config/avi-roles-config.js` → `migrateAviRoles()` (migración completa con transacciones, renombrado y validación de integridad).
- Mongo URI default: `mongodb://mongodb:27017/LibreChat` (hostname del servicio Docker).
- Orden de inicialización del script temporal (crítico para `module-alias`):
  1. `dotenv.config()` — variables de entorno
  2. `require('module-alias')({ base: apiRoot })` — alias `~`
  3. `require('mongoose')` — dependencias
  4. `require('../api/models')` — modelos (usan `~`)
  5. `migrateAviRoles(interactive)` — migración

### Ruta B — Local (script standalone simplificado)

```powershell
node config/reload-avi-roles-standalone.js -i
# Sin confirmación:
node config/reload-avi-roles-standalone.js
```

- Script: `config/reload-avi-roles-standalone.js` (289 líneas).
- Lógica: **migración inline simplificada** — NO reutiliza `avi-roles-config.js`.
- Mongo URI default: `mongodb://127.0.0.1:27017/LibreChat` (localhost).

### ⚠️ Diferencias críticas entre ambas rutas

| Aspecto | `reload-avi-roles.sh` (Docker) | `reload-avi-roles-standalone.js` (Local) |
|---|---|---|
| Sincroniza `registerAnswer` | ✅ Sí | ❌ **No** |
| Sincroniza `knowledge`/`behavior` de subroles | ✅ Sí | ❌ **No** (los setea en `null`) |
| Sincroniza `knowledge`/`behavior` de roles | ✅ Sí | ✅ Sí |
| Renombrado vía `migrations.roles/subroles` | ✅ Sí | ❌ No |
| Validación de integridad referencial | ✅ Sí (Paso 3) | ❌ No |
| Transacciones (replica set) | ✅ Sí | ❌ No |

> **Importante, Don Andres:** si editas `registerAnswer` o `knowledge`/`behavior` de subroles en el YAML y solo corres el script standalone local, esos cambios **no se propagarán** a MongoDB. Para sincronización completa usa la ruta Docker, aunque sea en desarrollo local (levantando el contenedor `api` o ejecutando contra la BD remota).

### Matriz de comandos por entorno

| Entorno | Comando |
|---|---|
| Desarrollo local (sincr. parcial) | `node config/reload-avi-roles-standalone.js -i` |
| Docker dev | `docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"` |
| Docker producción | `docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"` |

---

## Migración y Renombrado

Lógica: `config/avi-roles-config.js:231-336` (`migrateAviRoles`).

### Pasos de la migración (ruta Docker)

1. **`analyzeChanges`** (`:341-513`): calcula roles/subroles a crear, renombrar, actualizar (diffs de `knowledge`/`behavior`/`registerAnswer`) y eliminar.
2. Si `--interactive`, muestra resumen y pide confirmación `(y/n)` (`:527-687`).
3. Detecta replica set → usa transacciones si hay, sino corre sin ellas (compatible con standalone).
4. **Paso 1 — `migrateRoles`** (`:692-771`): renombra, crea, actualiza `knowledge`/`behavior`/`registerAnswer`, elimina roles ausentes en config (solo si no tienen usuarios asignados).
5. **Paso 2 — `migrateSubroles`** (`:776-882`): renombra, crea, actualiza `knowledge`/`behavior`/`registerAnswer`, elimina subroles ausentes o marcados `null` en `migrations.subroles`. Limpia `aviSubrol_id` de usuarios afectados.
6. **Paso 3 — `validateReferentialIntegrity`** (`:887-936`):
   - **Caso A:** usuario con `aviSubrol_id` pero sin `aviRol_id` → asigna rol desde `subrol.parentRolId`.
   - **Caso B:** subroles cuyo `parentRolId` ya no existe → eliminan + `$unset` en usuarios.

### Renombrado vía `migrations`

```yaml
aviRoles:
  migrations:
    roles:
      "nombreViejo": "nombreNuevo"
    subroles:
      "subrolViejo": "subrolNuevo"   # renombrar
      "subrolAEliminar": null         # eliminar
    defaultRoleForOrphans: "Residencia"
```

> `defaultRoleForOrphans` está declarado en el config pero **no es aplicado activamente** por el código de migración. La integridad referencial solo reasigna rol desde el `parentRolId` del subrol (Caso A), nunca cae al default. Alinear este valor con un rol existente (hoy apunta a `generico` que no existe en el YAML actual).

### Qué se sincroniza y qué no

| Cambio en `librechat.yaml` | ¿Se sincroniza a MongoDB? |
|---|---|
| `name` de rol/subrol | ✅ (con `migrations` para renombrar) |
| `knowledge` / `behavior` / `registerAnswer` | ✅ vía Docker · ⚠️ parcial vía standalone |
| `subroles` (agregar/eliminar) | ✅ |
| `initial_suggestions` | ❌ No (editar directo en MongoDB) |
| `instructionSuggestion` | ❌ No (campo muerto, ver Notas) |
| `conversationSuggestions.defaultInitialSuggestions` | ❌ No (requiere redeploy) |

---

## API de Métodos

Métodos factoría en `packages/data-schemas/src/methods/`. Exportados vía `createAviRolMethods` / `createAviSubrolMethods`.

### `aviRol.ts` (`:1-111`)

| Método | Firma | Descripción |
|---|---|---|
| `initializeAviRoles` | `async ()` | Crea roles por defecto **solo si** `avirols` está vacío. Persiste solo `name` (sin `knowledge`/`behavior`). |
| `listAviRoles` | `async ()` | `find({}).sort({ name: 1 }).lean()` |
| `getAviRolById` | `async (id)` | `findById(id).lean()` |
| `getAviRolByName` | `async (name)` | `findOne({ name }).lean()` |
| `createAviRol` | `async ({ name, knowledge?, behavior? })` | `new AviRol(data).save()` |
| `updateAviRol` | `async (id, { name?, knowledge?, behavior? })` | `findByIdAndUpdate(id, updates, { new, lean })` |
| `deleteAviRol` | `async (id)` | Rechaza si tiene subroles (`'Cannot delete role that has subroles assigned'`). |

### `aviSubrol.ts` (`:1-165`)

| Método | Firma | Descripción |
|---|---|---|
| `initializeAviSubroles` | `async ()` | Crea subroles solo si la colección está vacía. Persiste `name` + `parentRolId`. |
| `listAviSubroles` | `async ()` | `find({}).populate('parentRolId', 'name').sort({ parentRolId: 1, name: 1 }).lean()` |
| `getAviSubrolesByParentId` | `async (parentRolId)` | Subroles de un rol. |
| `getAviSubrolById` | `async (id)` | `findById(id).populate('parentRolId', 'name').lean()` |
| `validateSubrolBelongsToRole` | `async (subrolId, expectedParentRolId)` | Devuelve `{ isValid, error? }`. |
| `createAviSubrol` | `async ({ name, parentRolId, knowledge?, behavior? })` | Valida padre existente. |
| `updateAviSubrol` | `async (id, { name?, parentRolId?, knowledge?, behavior? })` | Valida padre si se provee. |
| `deleteAviSubrol` | `async (id)` | `findByIdAndDelete`. No valida usuarios asignados. |

### `user.ts` — métodos AVI (`:282-406`)

| Método | Firma | Descripción |
|---|---|---|
| `assignUserAviRoles` | `async (userId, aviRolId, aviSubrolId?)` | Valida rol y subrol, y que el subrol pertenezca al rol. |
| `getUserWithAviRoles` | `async (userId)` | Popula `aviRol_id`/`aviSubrol_id` con `name knowledge behavior registerAnswer`. |
| `removeUserAviRoles` | `async (userId)` | `$unset` de ambos campos. |
| `getUsersByAviRole` | `async (aviRolId)` | Popula `name knowledge behavior` (sin `registerAnswer`). |
| `validateUserAviRoles` | `async (userId)` | Devuelve `{ isValid, error? }`. |

> **Inconsistencia menor:** `getUsersByAviRole` no popula `registerAnswer`, mientras que `getUserWithAviRoles` sí. Relevante si reutilizas estos métodos en código nuevo.

---

## Notas y Advertencias

1. **`instructionSuggestion` es un campo muerto.** Aparece en `librechat.yaml` (ej. `:176`, `:206`) pero **no está en el schema Zod** (`config.ts:808-833`), por lo que se descarta al parsear y nunca llega a MongoDB ni al runtime. No tiene efecto alguno en la actualidad.

2. **`initializeAviRoles` / `initializeAviSubroles` solo persisten `name`** (y `parentRolId`). Los campos ricos (`knowledge`, `behavior`, `registerAnswer`) solo se propagan vía la migración (`migrateAviRoles`).

3. **`defaultRoleForOrphans: 'generico'`** en el YAML apunta a un rol que **no existe** en el `roles` actual (solo `Residencia` y `FAE`). Es efectivamente inoperante porque la migración no lo aplica. Alinearlo a un rol real.

4. **Las firmas TS de `createAviRol`/`updateAviRol`/`createAviSubrol`/`updateAviSubrol`** no declaran `initial_suggestions` ni `registerAnswer`, aunque el schema de Mongoose sí los soporta. Funciona en runtime (Mongoose no valida tipos TS), pero no están tipados.

5. **Validación de integridad referencial:** la migración repara usuarios con subrol pero sin rol (Caso A) derivando el rol desde `subrol.parentRolId`. No reasigna huérfanos al `defaultRoleForOrphans`.

6. **Endpoint de inyección:** `knowledge`/`behavior`/`registerAnswer` solo se inyectan en el system prompt del **endpoint Agents** (`agent.js`). Otros endpoints no los usan.

7. **`getUserWithAviRoles` NO popula `initial_suggestions`** — solo `name knowledge behavior registerAnswer`. Las sugerencias se leen por separado en `routes/suggestions.js`.

---

## 📚 Documentación Relacionada

- `Docs_AVI/GUIA_DEPLOY_DESARROLLO.md` - Deploy, entornos y desarrollo local
- `Docs_AVI/OPERACIONES.md` - Backups, sync Sheets, Health Check, invitaciones
- `Docs_AVI/README.md` - Índice de documentación

---

**Validada contra código:** rama `dev`, Junio 2026
**Mantenida por:** Equipo de Desarrollo AVI
