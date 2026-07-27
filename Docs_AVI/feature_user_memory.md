# Feature: User Memory (Memoria Persistente por Usuario)

> **Documento de hallazgos e implementación**
> Fecha: 2026-07-27
> Rama analizada: `segurity_report`
> Autor del análisis: investigación comparativa `origin/segurity_report` vs `upstream/main`

---

## ⚠️ Conclusión principal (leer primero)

**No hay que implementar nada. La feature User Memory YA ESTÁ COMPLETA en el fork.**

El único motivo por el que no funciona es que **falta el bloque `memory:` en `librechat.yaml`**.

| Esfuerzo estimado | ~30 minutos |
|---|---|
| Archivos de código a modificar | **0** |
| Archivos de configuración a modificar | **1** (`librechat.yaml`) |
| Riesgo de conflicto de merge | **Cero** |
| Riesgo de romper algo existente | **Muy bajo** (cambio aditivo y reversible) |

---

## 1. Contexto: por qué ya la tenemos

| Dato | Valor verificado |
|---|---|
| Versión del fork | `v0.8.0-rc4` |
| Versión de `upstream/main` | `v0.8.7` (commit `21dc4a2ef`, 2026-07-23) |
| **Merge-base** (punto de divergencia) | `bcec5bfce` — **2025-09-23** |
| Commits de upstream por delante | 1590 |
| Commits propios del fork | 136 (afectan 245 archivos) |
| **PR original de User Memory** | `29ef91b4d` — **2025-06-07** (#7760) |
| PR de límites de payload | `edf33bedc` — 2025-08-10 (#8974) |

La feature entró en upstream **3,5 meses antes** de que el fork divergiera. Por eso se heredó completa, junto con el hardening de payload limits.

### Verificación de que está cableada

```
✓ api/server/index.js:136          → app.use('/api/memories', routes.memories)
✓ api/server/routes/index.js:8,56  → ruta registrada
✓ api/server/controllers/agents/client.js:453-530 → integración en el flujo de chat
✓ packages/data-provider/src/permissions.ts:22 → PermissionTypes.MEMORIES
✓ client/src/hooks/Nav/useSideNavLinks.ts:118 → panel lateral "Memories"
✓ client/src/components/Nav/SettingsTabs/Personalization.tsx → opt-out del usuario
```

---

## 2. Qué es y cómo funciona

Memoria persistente **por usuario**, guardada como pares `key/value` en MongoDB e inyectada
en el system prompt de cada conversación nueva.

### Flujo completo

```
Usuario envía mensaje
   ↓
client.js #useMemory (api/server/controllers/agents/client.js:453)
   ↓
createMemoryProcessor()  ← packages/api/src/agents/memory.ts:410
   ↓
Sub-agente LLM dedicado ("memory agent") lee los últimos N mensajes
   ↓
Invoca 2 tools: set_memory / delete_memory   (memory.ts:76 y memory.ts:191)
   ↓
Colección MemoryEntry en MongoDB
   ↓
getFormattedMemories() inyecta el bloque de memoria en el system prompt
   ↓
Badge "Memory updated" en la UI del chat (MemoryInfo.tsx)
```

### Componentes

**Modelo de datos** — `packages/data-schemas/src/schema/memory.ts`
```
MemoryEntry { userId, key, value, tokenCount, updated_at }
```

**Métodos DB** — `packages/data-schemas/src/methods/memory.ts`
`createMemory` · `setMemory` · `deleteMemory` · `getAllUserMemories` · `getFormattedMemories`

**API REST** — `api/server/routes/memories.js`

| Método | Ruta | Descripción |
|---|---|---|
| `GET` | `/api/memories/` | Listar memorias del usuario |
| `POST` | `/api/memories/` | Crear memoria (con `memoryPayloadLimit`) |
| `PATCH` | `/api/memories/:key` | Actualizar memoria |
| `DELETE` | `/api/memories/:key` | Borrar memoria |
| `PATCH` | `/api/memories/preferences` | Opt-out del usuario |

**Permisos RBAC** — `PermissionTypes.MEMORIES`: `USE`, `CREATE`, `UPDATE`, `READ`, `OPT_OUT`
(configurables por rol desde el panel de administración)

**UI**
- `client/src/components/SidePanel/Memories/MemoryViewer.tsx` — tabla CRUD
- `MemoryCreateDialog.tsx` / `MemoryEditDialog.tsx` — diálogos
- `AdminSettings.tsx` — permisos por rol
- `client/src/components/Nav/SettingsTabs/Personalization.tsx` — toggle de opt-out
- `client/src/components/Chat/Messages/Content/MemoryArtifacts.tsx` / `MemoryInfo.tsx` — badge en el chat

### ⚠️ Particularidad de nuestra versión

En `packages/api/src/memory/config.ts:25-28`:

```ts
export function isMemoryEnabled(config: TMemoryConfig | undefined): boolean {
  if (isDisabled(config)) return false;
  return hasValidAgent(config!.agent);   // ← EXIGE agente válido
}
```

**Sin bloque `agent`, la memoria queda completamente apagada** — ni siquiera funciona el CRUD manual.
Upstream ya separó esto en `isMemoryEnabled` / `isMemoryAgentEnabled`, pero nosotros aún no.

**Implicación práctica: el bloque `agent:` es obligatorio en nuestra config.**

---

## 3. Conflictos anticipados

### Verificación realizada

```bash
git diff --name-only bcec5bfce..HEAD | grep -i memor
# → salida vacía
```

**Ninguno de los 136 commits propios toca un solo archivo de memory.**

### Riesgos reales

| Riesgo | Nivel | Detalle | Mitigación |
|---|---|---|---|
| Conflicto de merge | 🟢 Nulo | Cero solapamiento con commits propios | — |
| `librechat.yaml` | 🟡 Bajo | Convive con el bloque custom `aviRoles:` | `memory:` es top-level, no colisiona |
| Prompt injection | 🔴 **Alto** | La memoria inyecta texto controlado por el usuario en el system prompt | `validKeys` como allowlist estricta + `tokenLimit` |
| Coste / cuota LLM | 🟠 Medio | 1 llamada extra por mensaje, misma `GOOGLE_KEY` | Usar `gemini-2.5-flash`, no `pro` |
| Roles AVI | 🟠 Medio | `aviRoles` es paralelo al RBAC estándar; `MEMORIES` va por el RBAC nativo | Verificar permisos por rol en AdminSettings |

> **Nota de seguridad** (relevante para la rama `segurity_report`): el vector de prompt injection
> es real y propio de la feature. La memoria guarda texto que el usuario controla y luego lo
> reinyecta en el system prompt. `validKeys` es la defensa principal — sin ella el LLM puede
> crear claves arbitrarias con contenido arbitrario.

---

## 4. Implementación paso a paso (Fase 1 — la única necesaria)

### Paso 1 — Backup

```bash
cp librechat.yaml librechat.yaml.bak
```

### Paso 2 — Añadir el bloque `memory:` al final de `librechat.yaml`

```yaml
# ============================================
# User Memory - Memoria persistente por usuario
# ============================================
memory:
  # Habilitar la funcionalidad
  disabled: false

  # ALLOWLIST DE SEGURIDAD: restringe las claves que el LLM puede crear.
  # Sin esto, el modelo puede inventar claves arbitrarias (riesgo de inyección).
  validKeys:
    - preferences
    - work_info
    - personal_info
    - skills
    - interests
    - context

  # Límite de tokens del bloque de memoria inyectado en el system prompt
  tokenLimit: 10000

  # Muestra la pestaña "Personalization" en Settings (opt-out del usuario)
  personalize: true

  # Agente de memoria — OBLIGATORIO en nuestra versión
  agent:
    provider: "google"
    model: "gemini-2.5-flash"
    instructions: "Eres un asistente de gestión de memoria. Almacena información del usuario de forma precisa y concisa. Nunca almacenes credenciales, contraseñas ni datos sensibles."
    model_parameters:
      temperature: 0.1
```

### Paso 3 — Reiniciar el backend

Verificar en el log que **no** aparezca:
```
[api/server/controllers/agents/client.js #useMemory] No agent found for memory
```

### Paso 4 — Configurar permisos por rol

Entrar como **ADMIN** → panel lateral → icono **Memories** → **AdminSettings** →
activar `USE`, `CREATE`, `UPDATE`, `READ`, `OPT_OUT` para los roles que correspondan.

### Paso 5 — Prueba end-to-end

1. Enviar: *"Recuerda que prefiero respuestas en español y soy ingeniero"*
2. Verificar el badge de memoria en el mensaje (`MemoryInfo.tsx`)
3. Abrir el panel lateral **Memories** → confirmar que aparecen las entradas
4. Abrir una **conversación nueva** → verificar que el contexto persiste
5. Settings → **Personalization** → probar el toggle de opt-out
6. Probar CRUD manual: crear, editar y borrar una memoria desde el panel

### Rollback

Si algo falla:
```yaml
memory:
  disabled: true
```
o restaurar `librechat.yaml.bak`. No hay migración de esquema ni cambio de código que revertir.

---

## 5. Configuración con Gemini (verificado)

### Por qué funciona

En `api/server/controllers/agents/client.js:490-494` el `provider` se pasa como **nombre de endpoint**:

```js
endpoint: prelimAgent.id !== Constants.EPHEMERAL_AGENT_ID
  ? EModelEndpoint.agents
  : memoryConfig.agent?.provider,   // ← "google" resuelve al endpoint nativo
```

### Requisitos — todos ya cumplidos

| Requisito | Estado |
|---|---|
| `GOOGLE_KEY` en `.env` | ✅ presente |
| `ENDPOINTS=agents,google` | ✅ google habilitado |
| `endpoints.google` en `librechat.yaml` | ✅ configurado |
| `allowedProviders` sin restricción | ✅ vacío → el guard de `agent.js:56` (`size > 0`) no aplica |
| Modelos disponibles (`GOOGLE_MODELS`) | `gemini-2.5-flash`, `gemini-2.5-pro`, `gemini-2.5-flash-lite` |

### Advertencias

**Usar `gemini-2.5-flash`, no `flash-lite`.** El memory agent depende de *function calling*
(invoca las tools `set_memory` y `delete_memory`). Si el modelo no respeta el esquema, la
memoria no se guarda y solo queda un `logger.warn` en el log. `flash-lite` es más barato
pero menos fiable con tools estructuradas.

**No usar custom endpoints.** Si algún día se quisiera apuntar Gemini vía OpenRouter o un
proxy declarado bajo `endpoints.custom`, **nuestra versión no lo soporta** — ese soporte
llegó en el commit `b5aa38ff3` (#11214, enero 2026), posterior a nuestro merge-base.
Con el endpoint **nativo** `google` no hay problema.

**Consumo de cuota.** Cada mensaje dispara una llamada extra a Gemini, compartiendo la misma
`GOOGLE_KEY` y cuota que el chat principal. Vigilar el rate limit si se está en free tier.

---

## 6. Comparativa fork vs upstream (referencia)

### ✅ Idénticos a upstream (0 trabajo)

```
packages/api/src/memory/index.ts
client/src/components/Chat/Messages/Content/MemoryArtifacts.tsx
client/src/components/Chat/Messages/Content/MemoryInfo.tsx
+ sus 2 tests
```

### 🟡 Existen pero desactualizados

| Archivo | Δ (fork→upstream) | Qué cambió |
|---|---|---|
| `packages/api/src/agents/memory.ts` | +620 −90 | Particiones por agente, capability, tools inline |
| `client/src/components/SidePanel/Memories/AdminSettings.tsx` | +21 −200 | Migrado a `@librechat/client` |
| `packages/data-schemas/src/methods/memory.ts` | +91 −9 | Parámetro `agentId` |
| `api/server/routes/memories.js` | +57 −10 | Scope por agente, 404 JSON, tenant |
| `client/src/components/SidePanel/Memories/MemoryEditDialog.tsx` | +59 −31 | UI redesign |
| `client/src/utils/memory.ts` | +28 −18 | Helpers de partición |
| `client/src/data-provider/Memories/queries.ts` | +22 −11 | Query keys con `agentId` |
| `packages/data-schemas/src/schema/memory.ts` | +11 −0 | Campos `agentId` + `tenantId`, índice compuesto |
| `packages/data-schemas/src/types/memory.ts` | +13 −0 | Tipos `agentId` |
| `packages/data-schemas/src/models/memory.ts` | +5 −2 | `applyTenantIsolation()` |
| `packages/api/src/memory/config.ts` | +1 −28 | Vaciado: lógica movida a `data-schemas/src/app/memory.ts` |
| `client/src/components/SidePanel/Memories/index.ts` | +9 −1 | Re-exports nuevos |

### ❌ No existen en el fork

**Producción:**
```
packages/api/src/utils/memory.ts               ← truncado de input del memory agent
packages/data-schemas/src/app/memory.ts        ← isMemoryAgentEnabled + loadMemoryConfig
client/src/hooks/Roles/useHasMemoryAccess.ts
client/src/components/Chat/Input/Memory.tsx    ← toggle en el composer
client/src/components/Nav/Settings/MemoryToggle.tsx
client/src/components/SidePanel/Memories/{MemoryPanel,MemoryList,MemoryCard,MemoryCardActions,MemoryEmptyState,MemoryUsageBadge}.tsx
```

Los 6 últimos son la **descomposición de nuestro `MemoryViewer.tsx`** (que upstream eliminó).
Es refactor de UI, no funcionalidad nueva.

**Tests:** `packages/api/src/agents/memory.spec.ts`, `packages/api/src/memory/config.spec.ts`,
`packages/api/src/utils/__tests__/memory.test.ts`, `packages/data-schemas/src/methods/memory.spec.ts`,
`api/server/controllers/agents/__tests__/client.memory.spec.js`, `e2e/specs/mock/memory.spec.ts`

### 🔵 Solo en el fork — NO TOCAR

```
api/app/clients/memory/{index,summaryBuffer,summaryBuffer.demo,example}.js
```

Legacy de LangChain summary buffer, **sin relación** con User Memory. Upstream los eliminó
en otra limpieza. Borrarlos podría romper código que aún los importe.

---

## 7. Mejoras opcionales (Fase 2 — solo si Fase 1 funciona)

Hacer en **rama aparte**. Ninguna es necesaria para que la feature funcione.

### 7.1 — `agent.enabled` explícito (permite memoria manual sin agente LLM)

Upstream `74307e6dc` (#12886). En `packages/api/src/memory/config.ts`, separar las condiciones:

```ts
export function isMemoryEnabled(config?: TMemoryConfig): boolean {
  return !isDisabled(config);
}

export function isMemoryAgentEnabled(config?: TMemoryConfig): boolean {
  if (!isMemoryEnabled(config)) return false;
  return config?.agent?.enabled === true && hasValidAgent(config.agent);
}
```

Luego actualizar los call sites que hoy usan `isMemoryEnabled` para decidir si corre el agente.
**Es un cambio de comportamiento** — probar bien.

**Beneficio:** permite CRUD manual de memorias sin gastar llamadas LLM.

### 7.2 — `maxInputTokens` (control de coste)

Upstream `8fc231420` (#13606). Portar `packages/api/src/utils/memory.ts` y añadir el campo
al `memorySchema` de `data-provider`.

**Beneficio:** evita que conversaciones largas inflen el coste del memory agent.

---

## 8. Fase 3 — Diferir (NO hacer ahora)

Estas mejoras de upstream están **acopladas a infraestructura que el fork no tiene**.
Portarlas cuesta mucho y aporta poco.

| Commit upstream | Depende de… |
|---|---|
| `3945d293d` Per-Agent Memory Partitions (#14084) | Agent Builder rediseñado (#13952) |
| `397ddc536` Memory as Agent Capability (#13869) | HITL runtime (#13942, #12938) |
| `8ba2bde5c` Consolidar modelos en data-schemas | Reescritura completa de la capa DB |
| `e4e468840` Multi-Tenant Isolation (#12091) | ALS context middleware (#12407) |
| `733a9364c` Sidebar redesign / `@librechat/client` | Migración masiva de componentes |
| `9a5d7eaa4` `tiktoken` → `ai-tokenizer` | Cambio de dependencias |

Un cherry-pick de `3945d293d` arrastraría cientos de archivos.

**Recomendación:** posponer hasta un upgrade general del fork a v0.8.7+, y tratarlas como
parte de esa migración, no como feature aislada.

---

## 9. Checklist de ejecución

- [ ] Backup de `librechat.yaml`
- [ ] Añadir bloque `memory:` con `provider: google` / `model: gemini-2.5-flash`
- [ ] Reiniciar backend y revisar logs
- [ ] Configurar permisos `MEMORIES` por rol en AdminSettings
- [ ] Prueba: guardar memoria automática desde el chat
- [ ] Prueba: persistencia en conversación nueva
- [ ] Prueba: CRUD manual desde el panel lateral
- [ ] Prueba: opt-out en Settings → Personalization
- [ ] Verificar consumo de cuota de Gemini tras uso real
- [ ] (Opcional) Documentar `validKeys` finales según necesidades del proyecto

---

## Anexo — Notas

- El documento `Docs_AVI/PLAN_IMPLEMENTACION_USER_MEMORY.md` parte de la premisa errónea de que
  la feature no existe en el fork (menciona un "merge quirúrgico de `config.ts`" para añadir
  `memoryConfigSchema`). **Queda superado por este documento.**
- Todos los números de línea citados corresponden al estado de la rama `segurity_report`
  al 2026-07-27 y pueden desplazarse con cambios futuros.
