# 🚀 Plan de Implementación Final: Sistema AVI Roles Dinámico

**Fecha:** 16 de Octubre, 2025  
**Proyecto:** LibreChat-AVI  
**Repositorio:** Edo-Andres/LibreChat-AVI  
**Rama:** dev_local  
**Estado:** ✅ Aprobado para Implementación

---

## 📋 Índice
- [🎯 Objetivo](#-objetivo)
- [🏗️ Arquitectura de la Solución](#-arquitectura-de-la-solución)
- [📁 Archivos a Crear/Modificar](#-archivos-a-crearmodificar)
- [⚙️ Configuración](#-configuración)
- [📖 Reglas de Comportamiento](#-reglas-de-comportamiento)
- [🔄 Flujo de Ejecución](#-flujo-de-ejecución)
- [🧪 Casos de Uso](#-casos-de-uso)
- [🛡️ Manejo de Errores](#-manejo-de-errores)
- [✅ Checklist de Implementación](#-checklist-de-implementación)

---

## 🎯 Objetivo

Implementar un **sistema AVI roles dinámico** que permita:
1. ✅ Renombrar roles y subroles **sin reconstruir Docker**
2. ✅ Migración automática de usuarios y referencias
3. ✅ Configuración dinámica mediante `librechat.yaml` (override opcional por variable de entorno)
4. ✅ Scripts manuales para ejecución (automática e interactiva)
5. ✅ Fallback robusto a configuración por defecto

### 🐳 Infraestructura de Despliegue

Este proyecto usa:
- **`deploy-compose.yml`** - Orquestación de contenedores (LibreChat-API, MongoDB, Meilisearch, etc.)
- **`Dockerfile.multi`** - Imagen multi-stage de producción
- **Contenedor principal**: `LibreChat-API` (node:20-alpine)
- **Base de datos**: `chat-mongodb` (MongoDB sin auth, accesible desde contenedor API)
- **Volúmenes montados**: `librechat.yaml` (bind mount para configuración dinámica)

**Implicaciones para la implementación:**
- Los scripts se ejecutan **DENTRO del contenedor** `LibreChat-API`
- La conexión MongoDB usa la URI interna: `mongodb://mongodb:27017/LibreChat`
- Los cambios en `librechat.yaml` son inmediatos (volumen montado, no requiere rebuild)
- Para ejecutar scripts desde Windows: `docker exec LibreChat-API /app/scripts/<script>.sh`

---

## 🏗️ Arquitectura de la Solución

### **Componentes Principales:**

```
┌─────────────────────────────────────────────────────────┐
│  1. Fuente Principal: librechat.yaml                    │
│     └─ Sección `aviRoles` con roles, subroles y mapeos │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  2. Loader y Validador Existente                        │
│     └─ loadYaml() + configSchema + getAppConfig()      │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  3. Lógica de Migración (avi-roles-config.js)          │
│     ├─ Renombrar roles (mantener IDs)                  │
│     ├─ Crear/Eliminar subroles                         │
│     ├─ Validar integridad referencial                  │
│     └─ Migrar usuarios afectados                       │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  4. Scripts de Ejecución                                │
│     ├─ reload-avi-roles.sh (automático)                │
│     └─ reload-avi-roles.sh --interactive               │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  5. Métodos Existentes Actualizados                     │
│     ├─ initializeAviRoles() usa configuración dinámica │
│     └─ initializeAviSubroles() usa configuración       │
└─────────────────────────────────────────────────────────┘
```

**Nota:** Opcionalmente, se puede usar la variable de entorno `AVI_ROLES_CONFIG` como override temporal (JSON o Base64), pero `librechat.yaml` es la fuente preferida para cambios permanentes.

---

## 📁 Archivos a Crear/Modificar

### **🆕 ARCHIVOS NUEVOS (3):**

#### **1. `config/avi-roles-config.js`**
**Propósito:** Migrador y validador completo (se ejecuta dentro del contenedor)

**Funciones principales:**
- `getAviRolesFromConfig()` - Lee desde getAppConfig()
- `getConfiguredRoles()` - Lista roles configurados
- `getConfiguredSubroles(roleName)` - Lista subroles por rol
- `migrateAviRoles(interactive)` - Ejecuta migración completa

**Responsabilidades:**
- ✅ Lectura desde `/app/librechat.yaml` (montado como volumen)
- ✅ Override opcional desde AVI_ROLES_CONFIG
- ✅ Validación de estructura y conflictos
- ✅ Migración con transacciones
- ✅ Conexión a MongoDB interna: `mongodb://mongodb:27017/LibreChat`

#### **2. `scripts/reload-avi-roles.sh`**
**Propósito:** Script bash ejecutable dentro del contenedor Docker

**Ejecución:**
- Dentro del contenedor: `./scripts/reload-avi-roles.sh [--interactive]`
- Desde Windows host: `docker exec LibreChat-API /app/scripts/reload-avi-roles.sh [--interactive]`

**Características:**
- Usa la conexión MongoDB del contenedor
- No requiere configuración externa
- Logs visibles en consola del contenedor

#### **3. `scripts/invoke-reload-avi-roles.ps1`** (Helper para Windows)
**Propósito:** Script PowerShell para facilitar ejecución desde el host Windows

**Uso:**
```powershell
.\scripts\invoke-reload-avi-roles.ps1              # Modo automático
.\scripts\invoke-reload-avi-roles.ps1 -Interactive # Modo interactivo
```

Internamente ejecuta: `docker exec LibreChat-API /app/scripts/reload-avi-roles.sh`

---

### **📝 ARCHIVOS A MODIFICAR (4):**

#### **1. `Dockerfile.multi`**

**Agregar en la sección `api-build` (después de los otros scripts):**

```dockerfile
# ✅ Script para recarga dinámica de AVI Roles
COPY ./scripts/reload-avi-roles.sh ./scripts/reload-avi-roles.sh
RUN chmod +x ./scripts/reload-avi-roles.sh
```

**Ubicación:** Después de la línea que copia `health-check.sh` (~línea 85)

**Nota:** Sigue el mismo patrón que `sync-chats.sh` y `health-check.sh`

#### **2. `packages/data-schemas/src/methods/aviRol.ts`**

Cambiar de hardcoded a dinámico:

```typescript
// ANTES:
const defaultRoles = ['generico', 'cuidador', 'administrativo'];

// DESPUÉS:
const { getConfiguredRoles } = require('../../../../config/avi-roles-config');
const configuredRoles = await getConfiguredRoles();
```

#### **3. `packages/data-schemas/src/methods/aviSubrol.ts`**

Cambiar de hardcoded a dinámico:

```typescript
// DESPUÉS:
const { getConfiguredSubroles } = require('../../../../config/avi-roles-config');

for (const role of configuredRoles) {
  const subroles = await getConfiguredSubroles(role.name);
  // ... crear subroles
}
```

#### **4. `api/server/services/Config/schema.js` (o loadCustomConfig.js)**

Extender `configSchema` para incluir validación de `aviRoles`:

```javascript
// Agregar al schema Zod existente
aviRoles: z.object({
  roles: z.array(z.object({
    name: z.string(),
    subroles: z.array(z.string())
  })),
  migrations: z.object({
    roles: z.record(z.string()),
    subroles: z.record(z.string().or(z.null())),
    defaultRoleForOrphans: z.string().optional()
  }).optional()
}).optional()
```

---

## ⚙️ Configuración

### Fuente preferida: `librechat.yaml`

La fuente canónica para definir `aviRoles` debe ser la sección `aviRoles` dentro de `librechat.yaml`. El proyecto ya provee un loader y validador (`loadYaml` + `configSchema`) y la caché de configuración (`getAppConfig`) —por eso usar YAML facilita mantener cambios en despliegue, revisiones en Git y auditoría.

Ejemplo recomendado en `librechat.yaml` (se repite más arriba pero aquí por conveniencia):

```yaml
aviRoles:
  roles:
    - name: usuario_basico
      subroles:
        - Ver
        - Comentar
    - name: cuidador
      subroles:
        - Principal
        - Ayudante
  migrations:
    roles:
      generico: usuario_basico
    subroles:
      Lector: Ver
      Asistente: null
    defaultRoleForOrphans: usuario_basico
```

### Override opcional: `AVI_ROLES_CONFIG`

Si por alguna razón es necesario (por ejemplo, pruebas rápidas, CI o despliegues puntuales) se acepta una variable de entorno `AVI_ROLES_CONFIG` que contenga la configuración en JSON serializado o su variante codificada en Base64. Este valor será parseado y validado con el mismo `configSchema`.

Advertencias sobre el uso de la variable de entorno:

- No es recomendable para cambios complejos o permanentes: el JSON en una variable de entorno es difícil de mantener, revisar y versionar.
- Riesgo de errores de escape y de longitud en algunos entornos.
- Preferir editar `librechat.yaml` y usar `getAppConfig({ refresh: true })` para recargar.

Ejemplo rápido (PowerShell) — JSON directo:

```powershell
$Env:AVI_ROLES_CONFIG = '{"aviRoles": {"roles": [{"name":"generico","subroles":["Lector"]}], "migrations": {}}}'
# O, pasar solo la sección 'roles' (sin wrapper) si prefieres:
$Env:AVI_ROLES_CONFIG = '{"roles": [{"name":"generico","subroles":["Lector"]}], "migrations": {}}'
```

Ejemplo con Base64 (si el entorno lo requiere):

```powershell
$Env:AVI_ROLES_CONFIG = [System.Convert]::ToBase64String([System.Text.Encoding]::UTF8.GetBytes('{"aviRoles": {"roles": [...]}}'))
```

### Fallback

Si no existe `aviRoles` en `librechat.yaml` y no hay override válido en `AVI_ROLES_CONFIG`, el sistema aplicará una configuración por defecto controlada por código (DEFAULT_CONFIG) para garantizar que el sistema siga operativo.
Añade una sección `aviRoles` dentro de `librechat.yaml` (ejemplo abajo). El loader actual ya valida la estructura con `configSchema` y la cachea.

### Ejemplo de `aviRoles` en `librechat.yaml` (soporta múltiples mapeos):

```yaml
# librechat.yaml
aviRoles:
  roles:
    - name: usuario_basico
      subroles:
        - Ver
        - Comentar
        - Editar

    - name: cuidador_premium
      subroles:
        - Acceso Completo
        - Gestión Avanzada

    - name: super_admin
      subroles:
        - Administrador Total

  migrations:
    roles:
      generico: usuario_basico
      cuidador: cuidador_premium
      administrativo: super_admin

    subroles:
      Lector: Ver
      Comentarista: Comentar
      Colaborador: Editar
      "Cuidador Principal": "Acceso Completo"
      "Cuidador Secundario": "Gestión Avanzada"
      Asistente: null

    defaultRoleForOrphans: usuario_basico
```

---

### Flujo de lectura y prioridad

1. `loadCustomConfig()` ya lee `CONFIG_PATH` o `librechat.yaml` por defecto y valida con `configSchema`.
2. Si `aviRoles` existe en la configuración validada, se usa directamente.
3. `getAppConfig({ refresh: true })` permite forzar recarga desde `librechat.yaml`.
4. Si no existe `aviRoles`, se intenta leer `AVI_ROLES_CONFIG` como override opcional.
5. Si ambos fallan, se usa `DEFAULT_CONFIG` hardcoded.

---

## 📖 Reglas de Comportamiento

### **REGLA 1: Mapeos de Roles (usando `librechat.yaml`)**

 - ✅ Renombrar rol está permitido y debe mantener el mismo _id en la base de datos (no crear nuevos roles con nuevo _id).

Ejemplo de mapeo en `librechat.yaml`:

```yaml
migrations:
  roles:
    generico: usuario_basico
```

Comportamiento:

- BD antes: `{ _id: 67a8...1234, name: "generico" }`
- BD después: `{ _id: 67a8...1234, name: "usuario_basico" }`  ← MISMO ID
- Los usuarios con `aviRol_id` no necesitan cambios en el campo (siguen apuntando al mismo _id).

- ❌ Si el mapeo provoca conflicto de nombres (dos roles o más mapean al mismo nombre final), la migración será **rechazada** y mostrará un error:

```text
ERROR: Conflicto: 2 roles intentan usar el nombre 'admin' (revisar migrations.roles)
```

---

### **REGLA 2: Mapeos de Subroles (usando `librechat.yaml`)**

- ✅ Renombrar subrol está permitido y mantiene el mismo _id.

Ejemplo:

```yaml
migrations:
  subroles:
    Lector: Ver
    Asistente: null
```

Comportamiento:

- Renombrar: `{ _id: 67a8...5678, name: "Lector", parentRolId: 67a8...1234 }` → `{ _id: 67a8...5678, name: "Ver", parentRolId: 67a8...1234 }`.
- Eliminar (value: `null`): Borrar subrol de la colección y actualizar usuarios afectados: `aviSubrol_id` → `null`.

- IMPORTANTE: Los subroles **no listados en la nueva definición** del rol en `aviRoles.roles` serán **eliminados** (regla estricta acordada). Los usuarios con esos subroles recibirán `aviSubrol_id=null`.

---

### **REGLA 3: Subroles NO Mapeados**

Comportamiento (regla estricta acordada):

- Si renombraste un rol (ej. `generico` → `usuario_basico`) y la nueva definición del rol NO incluye algunos subroles antiguos, **esos subroles antiguos serán eliminados**.
- Los usuarios que tenían esos subroles verán `aviSubrol_id` puesto a `null`.
- El migrador generará un resumen con el conteo de subroles eliminados y usuarios afectados y lo mostrará en modo interactivo.

Ejemplo breve:

```
ANTES (generico): Lector, Comentarista, Colaborador
DESPUÉS (usuario_basico): Ver, Comentar
→ Eliminados: Lector, Comentarista, Colaborador
→ Usuarios afectados: aviSubrol_id → null
```

---

### **REGLA 4: Roles sin Usuarios**

Comportamiento acordado:

- Si un rol NO aparece en `aviRoles.roles` y **no tiene usuarios asignados**, será **eliminado** automáticamente.
- Si un rol NO aparece en `aviRoles.roles` pero **tiene usuarios asignados**, se **mantendrá** y se emitirá una advertencia en el reporte.

Ejemplo:

```
BD: generico (0 usuarios), cuidador (5 usuarios), administrativo (0 usuarios)
CONFIG: nuevo_rol

RESULTADO:
🗑️ Eliminar generico (0 usuarios)
✅ Mantener cuidador (5 usuarios) con advertencia
🗑️ Eliminar administrativo (0 usuarios)
✅ Crear nuevo_rol
```

---

### **REGLA 5: Validación de Integridad Referencial**

#### Caso A: Usuario con `aviSubrol_id` pero sin `aviRol_id`

Acción (autocorrección):

1. Buscar `AviSubrol` por `aviSubrol_id`.
2. Si existe y `parentRolId` existe → asignar `aviRol_id = parentRolId` al usuario.
3. Log de corrección aplicada.

Código conceptual:

```javascript
const subrol = await AviSubrol.findById(user.aviSubrol_id);
if (subrol && subrol.parentRolId) {
  await User.updateOne({ _id: user._id }, { $set: { aviRol_id: subrol.parentRolId } });
}
```

#### Caso B: Subrol huérfano (parentRolId no existe)

Acción (limpieza):

1. Eliminar el `AviSubrol` huérfano.
2. Actualizar usuarios con `aviSubrol_id` a `null`.
3. Log y reporte.

```javascript
await AviSubrol.deleteOne({ _id: subrol._id });
await User.updateMany({ aviSubrol_id: subrol._id }, { $unset: { aviSubrol_id: '' } });
```

---

### **REGLA 6: Conflictos de Nombres**

```javascript
// ❌ ROLES con mismo nombre (ERROR)
"roles": [
  {"name": "admin", "subroles": ["Sub1"]},
  {"name": "admin", "subroles": ["Sub2"]}  // ← Duplicado
]

→ Error: "Rol 'admin' está duplicado en configuración"
```

```javascript
// ✅ SUBROLES con mismo nombre en DIFERENTES roles (PERMITIDO)
"roles": [
  {"name": "basico", "subroles": ["Lector"]},
  {"name": "premium", "subroles": ["Lector"]}  // ← OK (parentRolId diferente)
]

→ Permitido: "Lector" de basico ≠ "Lector" de premium
```

---

### **REGLA 7: Transacciones y Atomicidad**

```javascript
// Usar transacciones MongoDB (si replica set disponible)
const session = await mongoose.startSession();
session.startTransaction();

try {
  // Todos los cambios
  await AviRol.updateMany(..., { session });
  await AviSubrol.updateMany(..., { session });
  await User.updateMany(..., { session });
  
  await session.commitTransaction();
  ✅ "Migración completada exitosamente"
} catch (error) {
  await session.abortTransaction();
  ❌ "Error en migración, cambios revertidos"
  throw error;
} finally {
  session.endSession();
}
```

---

### **REGLA 8: Fallbacks en Cascada**

```
1. librechat.yaml (aviRoles)
   ↓ (si no existe o es inválida)
2. Variable de entorno AVI_ROLES_CONFIG (override opcional)
   ↓ (si no existe o es inválida)
3. Configuración por defecto hardcoded (DEFAULT_CONFIG)
```

**Orden de prioridad:**
- Primera opción: leer `aviRoles` desde `librechat.yaml` usando `getAppConfig()`
- Segunda opción: si no existe o falla, intentar parsear `AVI_ROLES_CONFIG`
- Tercera opción: si ambas fallan, usar configuración hardcoded (generico, cuidador, administrativo)

---

## 🔄 Flujo de Ejecución

### **Método 1: Desde el Host Windows (Recomendado)**

Usando el script helper PowerShell:

```powershell
# Modo automático
.\scripts\invoke-reload-avi-roles.ps1

# Modo interactivo (con confirmación)
.\scripts\invoke-reload-avi-roles.ps1 -Interactive
```

### **Método 2: Comando Docker Directo**

```powershell
# Modo automático
docker exec LibreChat-API /app/scripts/reload-avi-roles.sh

# Modo interactivo
docker exec -it LibreChat-API /app/scripts/reload-avi-roles.sh --interactive
```

### **Método 3: Dentro del Contenedor**

```bash
# Acceder al contenedor
docker exec -it LibreChat-API sh

# Ejecutar script
cd /app
./scripts/reload-avi-roles.sh --interactive
```

---

### **Salida Esperada - Modo Automático:**

```bash
🔄 Recargando configuración AVI Roles - 2025-10-16 14:30:25
✅ Conectado a MongoDB (mongodb://mongodb:27017/LibreChat)

📊 Configuración parseada correctamente
📋 Roles actuales en BD: 3
   - generico (ID: 67a8...1234)
   - cuidador (ID: 67a8...5678)
   - administrativo (ID: 67a8...9abc)

📋 Roles en configuración nueva:
   - usuario_basico (3 subroles)
   - cuidador (3 subroles)
   - admin (3 subroles)

🔄 PASO 1: Migrando roles...
   🔄 Renombrando: "generico" → "usuario_basico"
      ✅ ID mantenido: 67a8...1234
   ✅ Rol "cuidador" sin cambios
   🔄 Renombrando: "administrativo" → "admin"
      ✅ ID mantenido: 67a8...9abc

🔄 PASO 2: Migrando subroles...
   📁 Procesando subroles de "usuario_basico":
      🔄 Renombrando subrol: "Lector" → "Ver"
         ✅ ID mantenido: 67a8...aaa
      🔄 Renombrando subrol: "Comentarista" → "Comentar"
         ✅ ID mantenido: 67a8...bbb
      🗑️  Eliminando subrol: "Colaborador"
         ✅ 5 usuarios migrados (subrol eliminado)

🔍 PASO 3: Validando integridad referencial...
✅ Estado final:
   - 3 roles
   - 9 subroles
✅ Todos los usuarios tienen roles válidos

✅ Migración completada exitosamente
👋 Desconectado de MongoDB

✅ Configuración actualizada exitosamente - 2025-10-16 14:30:40
```

---

### **Modo Interactivo:**

```bash
./scripts/reload-avi-roles.sh --interactive
```

```
🔄 Recargando configuración AVI Roles - 2025-10-16 14:30:25
✅ Conectado a MongoDB

📊 ANÁLISIS DE CAMBIOS:
════════════════════════════════════════════════════════

🔄 RENOMBRES DE ROLES:
   • "generico" → "usuario_basico" (150 usuarios afectados)
   • "administrativo" → "admin" (20 usuarios afectados)

➕ ROLES NUEVOS:
   (ninguno)

🗑️  ROLES A ELIMINAR:
   (ninguno)

🔄 RENOMBRES DE SUBROLES:
   • "Lector" → "Ver" (85 usuarios afectados)
   • "Comentarista" → "Comentar" (40 usuarios afectados)
   • "Colaborador" → "Editar" (25 usuarios afectados)

🗑️  SUBROLES A ELIMINAR:
   • "Asistente" (10 usuarios afectados → aviSubrol_id: null)

⚠️  ADVERTENCIAS:
   • Rol "cuidador" no está en config pero tiene 5 usuarios. Se mantiene.

════════════════════════════════════════════════════════
📊 RESUMEN:
   • 2 roles renombrados
   • 3 subroles renombrados
   • 1 subrol eliminado
   • Total usuarios afectados: 310

¿Desea continuar con la migración? (y/n): _
```

**Si usuario escribe `y`:**
```
✅ Confirmado. Ejecutando migración...
[... proceso de migración ...]
✅ Migración completada exitosamente
```

**Si usuario escribe `n`:**
```
❌ Migración cancelada por el usuario
👋 Desconectado de MongoDB
```

---

## 🧪 Casos de Uso

### **Caso 1: Renombrar Rol y Todos sus Subroles**

Ejemplo recomendado (añadir a `librechat.yaml`):

```yaml
aviRoles:
  roles:
    - name: usuario_basico
      subroles:
        - Ver
        - Comentar
        - Editar
    - name: cuidador
      subroles:
        - Principal
        - Ayudante
    - name: admin
      subroles:
        - SuperAdmin
  migrations:
    roles:
      generico: usuario_basico
      administrativo: admin
    subroles:
      Lector: Ver
      Comentarista: Comentar
      Colaborador: Editar
      "Cuidador Principal": "Principal"
      "Cuidador Secundario": "Ayudante"
      Asistente: null
      "Gestor de Usuarios": "SuperAdmin"
      "Configuración": "SuperAdmin"
      Supervisor: SuperAdmin
```

> Nota: si prefieres, el mismo contenido puede pasarse temporalmente por `AVI_ROLES_CONFIG` en JSON, pero editar `librechat.yaml` es la práctica recomendada.

**Resultado esperado:**

```
✅ 2 roles renombrados (IDs mantenidos)
✅ 9 subroles renombrados (IDs mantenidos)
✅ 1 subrol eliminado (Asistente)
✅ Todos los usuarios migrados correctamente
```

---

### **Caso 2: Agregar Nuevo Rol con Subroles**

Ejemplo (recomendado en `librechat.yaml`):

```yaml
aviRoles:
  roles:
    - name: generico
      subroles:
        - Lector
        - Comentarista
        - Colaborador
    - name: cuidador
      subroles:
        - Cuidador Principal
        - Cuidador Secundario
        - Asistente
    - name: administrativo
      subroles:
        - Gestor de Usuarios
        - Configuración
        - Supervisor
    - name: premium
      subroles:
        - Acceso Completo
        - Editor Avanzado
  migrations: {}
```

**Resultado esperado:**

```
✅ 3 roles existentes mantenidos sin cambios
✅ 1 rol nuevo creado: "premium"
✅ 2 subroles nuevos creados para "premium"
```

---

### **Caso 3: Eliminar Subroles Obsoletos**

Ejemplo (recomendado en `librechat.yaml`):

```yaml
aviRoles:
  roles:
    - name: generico
      subroles:
        - Lector
  migrations:
    subroles:
      Comentarista: null
      Colaborador: null
```

**Resultado esperado:**

```
✅ Rol "generico" mantenido
🗑️ Subrol "Comentarista" eliminado (usuarios afectados: aviSubrol_id → null)
🗑️ Subrol "Colaborador" eliminado (usuarios afectados: aviSubrol_id → null)
✅ Solo "Lector" disponible para "generico"
```

---

### **Caso 4: Consolidar Subroles (Varios → Uno)**

Ejemplo (recomendado en `librechat.yaml`):

```yaml
aviRoles:
  roles:
    - name: administrativo
      subroles:
        - SuperAdmin
  migrations:
    subroles:
      Gestor de Usuarios: SuperAdmin
      Configuración: SuperAdmin
      Supervisor: SuperAdmin
```

**Resultado esperado:**

```
✅ 3 subroles renombrados al mismo nombre "SuperAdmin"
✅ Usuarios con cualquiera de los 3 antiguos → ahora tienen "SuperAdmin"
⚠️  Nota: Mismo nombre, pero IDs diferentes en BD (cada uno mantiene su ID)
```

---

## 🛡️ Manejo de Errores

### **Error 1: JSON Malformado**

```env
AVI_ROLES_CONFIG='{"roles": [{"name": "generico"'  # ← Incompleto
```

**Comportamiento:**
```
❌ Error parseando JSON: Unexpected end of JSON input
⚠️  Usando configuración por defecto como fallback
✅ Roles por defecto: generico, cuidador, administrativo
```

---

### **Error 2: Config sin Roles**

```env
AVI_ROLES_CONFIG='{"roles": []}'
```

**Comportamiento:**
```
❌ Error: Config debe tener al menos 1 rol
⚠️  Usando configuración por defecto como fallback
✅ Roles por defecto: generico, cuidador, administrativo
```

---

### **Error 3: Conflicto de Nombres de Roles**

```env
"migrations": {
  "roles": {
    "generico": "admin",
    "administrativo": "admin"
  }
}
```

**Comportamiento:**
```
❌ ERROR CRÍTICO: Conflicto detectado
   2 roles intentan usar el nombre 'admin':
   - generico → admin
   - administrativo → admin

⚠️  Solución: Usa nombres únicos o elimina uno de los mapeos

→ Migración abortada, BD sin cambios
```

---

### **Error 4: Subrol Vacío en Config**

```env
"roles": [{"name": "generico", "subroles": ["Lector", "", "Comentarista"]}]
```

**Comportamiento:**
```
⚠️  Advertencia: Subrol vacío detectado en rol 'generico', omitiendo
✅ Crear solo: Lector, Comentarista
```

---

### **Error 5: Conexión a MongoDB Falla**

```
❌ Error conectando a MongoDB: connect ECONNREFUSED 127.0.0.1:27017
⚠️  Verifique:
   - MONGO_URI está correctamente configurado
   - MongoDB está corriendo
   - Red permite conexiones

→ Migración abortada
```

---

### **Error 6: Migración Falla a la Mitad (Transacción)**

```
✅ Roles migrados (3/3)
✅ Subroles migrados (5/9)
❌ Error en subrol 6/9: Connection lost

🔄 Ejecutando rollback automático...
✅ Transacción revertida
⚠️  BD restaurada al estado anterior
❌ Migración fallida, reintente después de verificar conexión
```

---

## ✅ Checklist de Implementación

### **FASE 1: Preparación (15 min)**
```
[ ] Crear archivo: config/avi-roles-config.js
[ ] Crear archivo: scripts/reload-avi-roles.sh
[ ] Crear archivo: scripts/invoke-reload-avi-roles.ps1 (helper Windows)
[ ] Modificar: packages/data-schemas/src/methods/aviRol.ts
[ ] Modificar: packages/data-schemas/src/methods/aviSubrol.ts
[ ] Modificar: Dockerfile.multi (agregar COPY y chmod del script)
[ ] Extender: api/server/services/Config/schema.js (validación aviRoles)
[ ] Agregar scripts en package.json
```

---

### **FASE 2: Build y Despliegue (5-10 min)**
```
[ ] Hacer rebuild de la imagen Docker:
    docker-compose -f deploy-compose.yml build api
    
[ ] Reiniciar contenedores:
    docker-compose -f deploy-compose.yml down
    docker-compose -f deploy-compose.yml up -d
    
[ ] Verificar que el script tiene permisos:
    docker exec LibreChat-API ls -la /app/scripts/reload-avi-roles.sh
    
[ ] Verificar conectividad MongoDB desde contenedor:
    docker exec LibreChat-API node -e "require('mongoose').connect('mongodb://mongodb:27017/LibreChat').then(() => console.log('OK'))"
```

---

### **FASE 3: Testing en Contenedor (1 hora)**
```
[ ] Test: Lectura de librechat.yaml desde contenedor
    Editar librechat.yaml (agregar sección aviRoles)
    Ejecutar: docker exec LibreChat-API node -e "require('./config/avi-roles-config').getAviRolesFromConfig().then(console.log)"
    
[ ] Test: Migración en modo dry-run (interactivo)
    docker exec -it LibreChat-API /app/scripts/reload-avi-roles.sh --interactive
    
[ ] Test: Migración real (automático)
    docker exec LibreChat-API /app/scripts/reload-avi-roles.sh
    
[ ] Test: Verificar roles en MongoDB
    docker exec chat-mongodb mongosh LibreChat --eval "db.avirols.find().pretty()"
    
[ ] Test: Verificar subroles en MongoDB
    docker exec chat-mongodb mongosh LibreChat --eval "db.avisubrols.find().pretty()"
    
[ ] Test: Idempotencia (ejecutar 2 veces, mismo resultado)
    
[ ] Test: Fallback (eliminar aviRoles de librechat.yaml, debe usar DEFAULT_CONFIG)
    
[ ] Test: Override con AVI_ROLES_CONFIG
    Agregar variable en deploy-compose.yml y rebuild
```

---

### **FASE 4: Validación en Producción (15 min)**
```
[ ] Backup de MongoDB antes de migración real
    docker exec chat-mongodb mongodump --out=/data/db/backup-$(date +%Y%m%d)
    
[ ] Ejecutar migración interactiva y revisar resumen
    
[ ] Confirmar migración
    
[ ] Verificar usuarios en la aplicación web (login y permisos)
    
[ ] Monitorear logs:
    docker logs -f LibreChat-API
```

---

### **FASE 5: Post-Despliegue**
```
[ ] Documentar en README cómo recargar roles
[ ] Crear ejemplos de configuración en librechat.yaml
[ ] Training de administradores sobre uso
[ ] Establecer procedimiento de backup antes de migración
```

---

## 📚 Documentación Adicional

### **README para Administradores:**

**Crear archivo:** `README_AVI_ROLES_DYNAMIC.md`

**Contenido:**
- Guía de uso paso a paso
- Ejemplos de configuraciones comunes
- Troubleshooting
- FAQ

---

### **Logs y Monitoreo:**

**Ubicación de logs:**
```
/app/api/logs/avi-roles-migration.log
```

**Formato de logs:**
```
[2025-10-16 14:30:25] INFO: Iniciando migración de AVI Roles
[2025-10-16 14:30:26] INFO: Configuración parseada correctamente
[2025-10-16 14:30:27] WARN: Rol 'cuidador' no está en config pero tiene 5 usuarios
[2025-10-16 14:30:28] INFO: Renombrando rol: generico → usuario_basico
[2025-10-16 14:30:29] INFO: Migración completada exitosamente
```

---

## 🎯 Resumen Ejecutivo

**Características principales:**
- ✅ Configuración dinámica vía `librechat.yaml` (override opcional por variable de entorno)
- ✅ Sin necesidad de rebuild de Docker
- ✅ Migración automática de usuarios
- ✅ Validación robusta con múltiples fallbacks
- ✅ Transacciones para garantizar atomicidad
- ✅ Modo interactivo con confirmación
- ✅ Logs detallados para auditoría
- ✅ Mantenimiento de IDs (no rompe referencias)

**Tiempo estimado de implementación:** 3-4 horas

**Complejidad:** Media

**Riesgo:** Bajo (múltiples validaciones y transacciones)

---

**Estado:** ✅ Listo para implementación

**Fecha de actualización:** 16 de Octubre, 2025

---

_Este documento es el plan final aprobado para la implementación del sistema AVI Roles Dinámico._
