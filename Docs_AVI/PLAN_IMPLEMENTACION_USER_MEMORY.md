# Plan de Implementación — User Memory en LibreChat-AVI

**Autor**: Don Andres / Edo-Andres
**Fecha**: 2026-07-27
**Branch base**: `segurity_report` (HEAD = `31d1e3a39`)
**Branch destino**: `dev_feat_user_memory`
**Merge-base con upstream/main**: `bcec5bf` (2025-09-23, v0.8.0-rc4 previo)
**Commits de diferencia**: 1590 upstream / 136 fork
**Estado**: PLAN (no ejecutado)

---

## Decisiones de Scope

1. **Permisos**: NO se tocan `packages/data-schemas/src/schema/role.ts` ni `types/role.ts`. Memoria habilitada para **todos los usuarios** con defaults de upstream (`MEMORIES.USE = true`). Sin granularidad por rol AVI.
2. **Backport quirúrgico** en `agents/client.js`, `agents/initialize.js`, `handleTools.js`: extraer solo los bloques de memoria, NO copiar los 1500+ cambios de HITL/steering/background-tools.
3. **Bloque AVI de variable replacement** en `api/server/services/Endpoints/agents/agent.js` se conserva en su lugar actual (no se migra a `packages/api`).

---

## 1. ¿Qué es User Memory?

Sistema de memoria persistente por usuario con **3 capas**:

### Capa A — Post-turn Memory Agent (PR #7760, commit `29ef91b4d`)
**YA EXISTE** en el fork (es ancestro del merge-base). Tras cada turno, un agente de memoria opcional procesa los últimos N mensajes (`messageWindowSize`, default 5) y crea/actualiza entradas `MemoryEntry { userId, key, value }` contra `validKeys` y `tokenLimit`. Se inyecta en futuros system prompts. UI: SidePanel/Memories + tab Personalization.

### Capa B — Inline Memory Capability (PR #13869, commit `397ddc536`)
**FALTA** en el fork. Inline tools `set_memory`/`delete_memory` disponibles para el agente durante la conversación. Badge efímero + toggle en Agent Builder. Gates: capability habilitada, `memory` configurado en yaml, permisos, opt-out. Caché WeakMap por request.

### Capa C — Per-Agent Memory Partitions (PR #14084, commit `3945d293d`)
**FALTA** en el fork. Campo `memory_scope: 'user'|'agent'` + `agentId` en `MemoryEntry`. Aislamiento de memoria por agente. UI refactorizada con MemoryCard/MemoryList/MemoryPanel.

### Configuración (`librechat.yaml`)
```yaml
memory:
  disabled: false
  validKeys: ["preferences","work_info","personal_info","skills","interests","context"]
  tokenLimit: 10000
  maxInputTokens: 12000       # NUEVO
  personalize: true
  agent:
    enabled: true             # NUEVO
    id: "..." # o inline provider/model/instructions
```

---

## 2. Arquitectura

- **Mongoose model** → `MemoryEntry` en `packages/data-schemas` con plugin `mongoMeili`
- **Métodos** → `packages/data-schemas/src/methods/memory.ts` (CRUD + token counting + validación + particiones)
- **API routes** → `api/server/routes/memories.js` (REST + permisos de rol)
- **API config** → `packages/api/src/memory/config.ts` + `index.ts` (carga/valida bloque yaml)
- **Agente de memoria** → `packages/api/src/agents/memory.ts` (post-turn, inline tools, caché WeakMap, particiones)
- **Integración runtime** → `api/server/controllers/agents/client.js`, `api/server/services/Endpoints/agents/initialize.js`, `api/app/clients/tools/util/handleTools.js`
- **Frontend** → SidePanel/Memories (MemoryPanel, MemoryList, MemoryCard, dialogs, admin settings), Personalization tab, MemoryToggle en Agent Builder, hook `useHasMemoryAccess`, `MemoryArtifacts`/`MemoryInfo` en mensajes
- **Permisos** → `MEMORIES.USE/CREATE/UPDATE/READ` (defaults globales, sin integración con AVI)

---

## 3. Archivos a modificar

### 3.1 Archivos NUEVOS (copiar desde upstream)

| Archivo | Descripción |
|---|---|
| `packages/data-schemas/src/app/memory.ts` | Schema de validación para config memory |
| `packages/data-schemas/src/methods/memory.spec.ts` | Tests de métodos memory |
| `packages/api/src/agents/memory.spec.ts` | Tests del agente de memoria |
| `packages/api/src/memory/config.spec.ts` | Tests de config memory |
| `packages/api/src/utils/memory.ts` | Utilidades de memoria |
| `packages/api/src/utils/__tests__/memory.test.ts` | Tests de utilidades |
| `client/src/components/Chat/Input/Memory.tsx` | Input badge de memoria inline |
| `client/src/components/Nav/Settings/MemoryToggle.tsx` | Toggle de memoria en Settings |
| `client/src/components/SidePanel/Agents/Memory.tsx` | Toggle en Agent Builder |
| `client/src/components/SidePanel/Memories/MemoryCard.tsx` | Card individual de memoria |
| `client/src/components/SidePanel/Memories/MemoryCardActions.tsx` | Acciones de card |
| `client/src/components/SidePanel/Memories/MemoryEmptyState.tsx` | Estado vacío del panel |
| `client/src/components/SidePanel/Memories/MemoryList.tsx` | Lista paginada de memorias |
| `client/src/components/SidePanel/Memories/MemoryPanel.tsx` | Panel principal de memorias |
| `client/src/components/SidePanel/Memories/MemoryUsageBadge.tsx` | Badge de uso de tokens |
| `client/src/hooks/Roles/useHasMemoryAccess.ts` | Hook de acceso a memoria |

### 3.2 Archivos a REEMPLAZAR (existen desactualizados)

| Archivo | Líneas fork → upstream | Cambios clave |
|---|---|---|
| `packages/data-schemas/src/methods/memory.ts` | 151 → 230 | Partición: `agentId`, `memory_scope` |
| `packages/data-schemas/src/models/memory.ts` | +5/-2 | Índice compuesto para partición |
| `packages/data-schemas/src/schema/memory.ts` | +11 | Campos `agentId`, `memory_scope` |
| `packages/data-schemas/src/types/memory.ts` | +13 | Tipos `TMemoryScope` |
| `packages/api/src/agents/memory.ts` | 476 → 967 | **Núcleo**: inline tools, caché WeakMap, particiones, gates |
| `packages/api/src/memory/config.ts` | +1/-28 | `maxInputTokens`, `agent.enabled` |
| `packages/api/src/memory/index.ts` | Sin cambios | Confirmar |
| `api/server/routes/memories.js` | 249 → 294 | Partición, `maxInputTokens` |
| `client/src/data-provider/Memories/queries.ts` | +22/-11 | Partición en queries |
| `client/src/utils/memory.ts` | +28/-18 | Partición en utils |
| `client/src/components/SidePanel/Memories/MemoryCreateDialog.tsx` | +6/-4 | Ajustes partición |
| `client/src/components/SidePanel/Memories/MemoryEditDialog.tsx` | +59/-31 | Refactor UI |
| `client/src/components/SidePanel/Memories/AdminSettings.tsx` | +21/-200 | Refactor permisos |
| `client/src/components/SidePanel/Memories/index.ts` | +9/-1 | Nuevos exports |
| `packages/api/src/agents/__tests__/memory.test.ts` | +25/-7 | Tests actualizados |

### 3.3 Archivos a ELIMINAR

| Archivo | Motivo |
|---|---|
| `client/src/components/SidePanel/Memories/MemoryViewer.tsx` | Refactorizado a MemoryPanel + MemoryList + MemoryCard |

### 3.4 Archivos con MERGE MANUAL de exports

| Archivo | Acción |
|---|---|
| `packages/data-schemas/src/methods/index.ts` | Añadir export `memory` |
| `packages/data-schemas/src/models/index.ts` | Añadir export `memory` |
| `packages/data-schemas/src/schema/index.ts` | Añadir export `memory` |
| `packages/data-schemas/src/types/index.ts` | Añadir export `MemoryEntry`, `Memory`, `TMemoryConfig` |
| `packages/data-schemas/src/index.ts` | Re-export |
| `packages/data-provider/src/index.ts` | Añadir memory hooks |
| `packages/data-provider/src/keys.ts` | Añadir keys `memories` |
| `client/src/components/SidePanel/Memories/index.ts` | Reemplazar `MemoryViewer` por `MemoryPanel` |

### 3.5 Archivos con MERGE MANUAL (fork + upstream tocan)

| Archivo | Estrategia |
|---|---|
| `api/server/routes/index.js` | Añadir `memories` + conservar `aviRoles`, `suggestions` |
| `api/server/services/AppService.js` | Conservar `conversationSuggestions` + aplicar memory capability strip |
| `librechat.example.yaml` | Añadir `maxInputTokens`, `agent.enabled` al bloque memory; conservar `aviRoles` |
| `packages/data-schemas/src/schema/user.ts` | Conservar campos AVI + añadir `memory.personalization` opt-out |
| `packages/data-schemas/src/methods/user.ts` | Conservar métodos AVI + añadir `updateMemoryPreferences` |
| `packages/data-schemas/src/types/user.ts` | Conservar tipos AVI + añadir tipos memory |
| `client/src/locales/en/translation.json` | Añadir keys de memoria |
| `client/src/locales/es/translation.json` | Añadir keys de memoria |
| `client/src/hooks/SSE/useAttachmentHandler.ts` | Aplicar +17 líneas de `handleMemoryArtifact` |
| `client/src/components/Nav/Settings.tsx` | Asegurar tab Personalization |

### 3.6 Backport quirúrgico (3 archivos críticos)

| Archivo | Hunks a extraer | Líneas aprox. |
|---|---|---|
| `api/server/controllers/agents/client.js` | `import agentHasInlineMemoryTools`, `useMemory`, `getRequestMemories`; `injectMemoryContext` (withKeys/withoutKeys); callback memory artifact | ~80 |
| `api/server/services/Endpoints/agents/initialize.js` | `memoryAvailable` gate; `registerMemoryTools`/`buildInlineMemoryTool`; flag `memoryToolsRegistered` | ~120 |
| `api/app/clients/tools/util/handleTools.js` | `isMemoryToolAllowed`/`buildInlineMemoryTool`; gate permisos WRITE; validación tamaño/keys; re-check capability | ~60 |

---

## 4. Conflictos anticipados

| Severidad | Archivo | Causa | Solución |
|---|---|---|---|
| 🔴 Alta | `agents/agent.js` | Fork añade bloque AVI; upstream eliminó 210 líneas | Mantener bloque AVI en `agent.js`. No migrar a `packages/api`. |
| 🔴 Alta | `agents/client.js` | Backport quirúrgico sobre 2380 líneas cambiadas | Extraer solo ~80 líneas de memory. Probar iterativamente. |
| 🔴 Alta | `packages/api/src/agents/memory.ts` | 620 líneas nuevas dependen de `initialize.ts`, `validation.ts`, `run.ts` | Portar dependencias mínimas una a una. Tag de backup. |
| 🟡 Media | `AppService.js` | Conservar `conversationSuggestions` + memory capability strip | Merge manual |
| 🟡 Media | `routes/config.js` | Conservar PostHog/ElevenLabs/`conversationSuggestions` | NO sobrescribir. Solo añadir lo necesario. |
| 🟡 Media | `{schema,methods,types}/user.ts` | Ambos añaden campos a User | Merge manual |
| 🟡 Media | `data-provider/{api-endpoints,data-service,config,types}.ts` | Upstream añadió 500-1500 líneas no relacionadas | Extracción quirúrgica de solo memory |
| 🟢 Baja | `routes/index.js` | Trivial: ambos añaden imports | Merge manual |
| 🟢 Baja | `*/index.ts` (data-schemas) | Trivial: ambos añaden exports | Merge manual |
| 🟢 Baja | `librechat.example.yaml` | Trivial: ambos añaden bloques distintos | Merge manual |
| 🟢 Baja | `translation.json` | Añadir keys | Merge manual |

**Sin conflicto confirmado**: todo el código AVI (`aviRoles.js`, `aviRol.ts`, `aviSubrol.ts`, `config/avi-roles-config.js`, scripts, docs, assets).

---

## 5. Plan de ejecución paso a paso

### Preparación

```
git checkout segurity_report
git checkout -b dev_feat_user_memory
git tag backup-pre-memory
```

Verificar que `npm run backend:dev` y `npm run frontend:dev` arrancan limpios.

---

### Fase 1 — packages/data-schemas

1. `git checkout upstream/main -- packages/data-schemas/src/app/memory.ts`
2. `git checkout upstream/main -- packages/data-schemas/src/methods/memory.spec.ts`
3. `git checkout upstream/main -- packages/data-schemas/src/methods/memory.ts`
4. `git checkout upstream/main -- packages/data-schemas/src/models/memory.ts`
5. `git checkout upstream/main -- packages/data-schemas/src/schema/memory.ts`
6. `git checkout upstream/main -- packages/data-schemas/src/types/memory.ts`
7. Merge manual `methods/index.ts` — añadir `memory`
8. Merge manual `models/index.ts` — añadir `memory`
9. Merge manual `schema/index.ts` — añadir `memory`
10. Merge manual `types/index.ts` — añadir `MemoryEntry`, `Memory`, `TMemoryConfig`
11. Merge manual `src/index.ts` — re-export
12. Merge manual `schema/user.ts` — conservar campos AVI + añadir `memory.personalization`
13. Merge manual `methods/user.ts` — conservar métodos AVI + añadir `updateMemoryPreferences`
14. Merge manual `types/user.ts` — conservar tipos AVI + añadir tipos memory
15. NO tocar `schema/role.ts`, `types/role.ts`
16. `cd packages/data-schemas && npm run build`

---

### Fase 2 — packages/api

1. `git checkout upstream/main -- packages/api/src/memory/config.ts`
2. `git checkout upstream/main -- packages/api/src/memory/config.spec.ts`
3. `git checkout upstream/main -- packages/api/src/memory/index.ts`
4. `git checkout upstream/main -- packages/api/src/agents/memory.ts`
5. `git checkout upstream/main -- packages/api/src/agents/memory.spec.ts`
6. `git checkout upstream/main -- packages/api/src/utils/memory.ts`
7. `git checkout upstream/main -- packages/api/src/utils/__tests__/memory.test.ts`
8. Compilar: `cd packages/api && npm run build`
9. Resolver dependencias faltantes iterativamente:
   - Si `memory.ts` importa de `agents/initialize.ts` y no existe → portar subconjunto
   - Si importa de `agents/validation.ts` → portar `memory_scope` validation
   - Si importa de `agents/run.ts` → portar `runMemory`
   - Si importa de `agents/resources.ts` → portar `primeResources`
   - Si importa de `utils/tokenizer.ts` → portar `countTokens`
   - Si importa de `types/run.ts` → portar tipos
10. Confirmar build limpio

---

### Fase 3 — Backend Express

1. `git checkout upstream/main -- api/server/routes/memories.js`
2. Merge manual `api/server/routes/index.js`
3. Merge manual `api/server/services/AppService.js`
4. **Backport quirúrgico** `api/server/controllers/agents/client.js`
5. **Backport quirúrgico** `api/server/services/Endpoints/agents/initialize.js`
6. **Backport quirúrgico** `api/app/clients/tools/util/handleTools.js`
7. Revisar `api/server/services/start/interface.js` (memory config load)
8. `npm run backend:dev` — verificar logs sin errores

---

### Fase 4 — packages/data-provider

1. `git checkout upstream/main -- client/src/data-provider/Memories/queries.ts`
2. Revisar `packages/data-provider/src/memory.ts` — sobrescribir si fork sin cambios
3. Merge quirúrgico `api-endpoints.ts` — añadir constantes memory (~10 líneas)
4. Merge quirúrgico `data-service.ts` — añadir hooks memory
5. Merge quirúrgico `config.ts` — añadir `memoryConfigSchema`
6. Merge quirúrgico `types.ts` — añadir tipos memory (~30 líneas)
7. Merge quirúrgico `keys.ts` — añadir keys `memories`
8. Merge `index.ts` — re-export
9. `cd packages/data-provider && npm run build`

---

### Fase 5 — Frontend

1. Copiar desde upstream (archivos nuevos):
   - `client/src/components/Chat/Input/Memory.tsx`
   - `client/src/components/Nav/Settings/MemoryToggle.tsx`
   - `client/src/components/SidePanel/Agents/Memory.tsx`
   - `client/src/components/SidePanel/Memories/MemoryCard.tsx`
   - `client/src/components/SidePanel/Memories/MemoryCardActions.tsx`
   - `client/src/components/SidePanel/Memories/MemoryEmptyState.tsx`
   - `client/src/components/SidePanel/Memories/MemoryList.tsx`
   - `client/src/components/SidePanel/Memories/MemoryPanel.tsx`
   - `client/src/components/SidePanel/Memories/MemoryUsageBadge.tsx`
   - `client/src/hooks/Roles/useHasMemoryAccess.ts`
2. Reemplazar (desactualizados):
   - `client/src/components/SidePanel/Memories/MemoryCreateDialog.tsx`
   - `client/src/components/SidePanel/Memories/MemoryEditDialog.tsx`
   - `client/src/components/SidePanel/Memories/AdminSettings.tsx`
   - `client/src/components/SidePanel/Memories/index.ts`
   - `client/src/utils/memory.ts`
3. **Eliminar** `MemoryViewer.tsx` — actualizar `index.ts`
4. Merge manual `useAttachmentHandler.ts` — +17 líneas
5. Merge manual `Settings.tsx` — verificar tab Personalization
6. Merge manual `locales/en/translation.json` — añadir keys de memoria
7. Merge manual `locales/es/translation.json` — añadir keys de memoria
8. Verificar imports: `grep -r "MemoryViewer" client/src/` debe ser 0
9. `npm run frontend:dev` — sin errores

---

### Fase 6 — Configuración

1. Merge manual `librechat.example.yaml`:
   - Añadir `maxInputTokens: 12000`
   - Añadir `agent:` con `enabled: true`
   - Conservar bloque `aviRoles`
2. En `librechat.yaml` activo: descomentar/configurar bloque `memory`
3. NO requiere `reload-avi-roles`

---

### Fase 7 — Verificación

1. `cd packages/data-schemas && npm run build`
2. `cd packages/api && npm run build`
3. `cd packages/data-provider && npm run build`
4. `npm run backend:dev` — sin errores, logs de memoria
5. `npm run frontend:dev` — sin errores
6. Lint: `npm run lint` en `client/`, `api/`, `packages/*`
7. Typecheck: `npm run typecheck` en `client/`, `api/`, `packages/*`
8. Test funcional:
   - Crear/editar/eliminar memoria manual
   - Memoria creada automáticamente por memory agent post-turn
   - Agente con capability memory: badge visible, set_memory/delete_memory
   - Memory scope por agente
   - Personalization opt-out funciona
9. Test E2E (opcional): `e2e/specs/mock/memory.spec.ts`

---

### Fase 8 — Commit

Commits sugeridos:
1. `feat(data-schemas): add User Memory schema, methods, partitions`
2. `feat(api): inline memory tools and post-turn memory agent`
3. `feat(backend): wire memory routes and capability gates`
4. `feat(data-provider): memory hooks and queries`
5. `feat(client): memory UI panel, dialogs, agent builder toggle`
6. `chore(config): enable memory in librechat.yaml`

Push: `git push origin dev_feat_user_memory`

---

## 6. Resumen de tiempo estimado

| Fase | Descripción | Duración estimada |
|---|---|---|
| 1 | data-schemas | 30-45 min |
| 2 | packages/api | 45-60 min |
| 3 | Backend Express | 60-90 min |
| 4 | data-provider | 30-45 min |
| 5 | Frontend | 45-60 min |
| 6 | Configuración | 15 min |
| 7 | Verificación | 30-45 min |
| 8 | Commit | 15 min |
| **Total** | | **4-6 horas** |
