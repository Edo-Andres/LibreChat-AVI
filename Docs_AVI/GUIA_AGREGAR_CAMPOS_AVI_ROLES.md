# 🎯 Guía: Cómo Agregar Nuevos Campos a aviRol/aviSubrol

**Propósito**: Blueprint para que un agente inteligente implemente nuevos campos en el sistema AVI Roles y los exponga como variables especiales en prompts.

**Ejemplo de referencia**: Implementación de `knowledge` y `behavior` (ver `IMPLEMENTACION_KNOWLEDGE_BEHAVIOR.md`)

---

## 🔴 IMPORTANTE: Fuente de Datos

Los valores de los campos `knowledge`, `behavior` y `subroles` de los roles AVI provienen de **`librechat.yaml`**:

```yaml
# AVI Roles Dynamic Configuration
# Sistema dinámico de roles y subroles para LibreChat-AVI
aviRoles:
  roles:
    - name: Roles_AVI
      knowledge: "Conocimiento para usuarios AVI"
      behavior: "Tono: Amable, orientado a cuidado de niños."
      subroles:
        - Cuidador
        - Psicólogo
        - Administrativo
    
    - name: Humorista
      knowledge: "Conocimiento general básico"
      behavior: "Eres humorista así que te responderé de forma graciosa."
      subroles:
        - Payaso        
        - Comediante
```

**⚠️ Regla Crítica**: Cualquier campo nuevo que agregues a `librechat.yaml` debe:
1. ✅ Estar definido en el **schema de MongoDB** (`packages/data-schemas/src/schema/aviRol.ts`)
2. ✅ Ser **leído y procesado** por el script de carga (`scripts/reload-avi-roles.sh`)
3. ✅ Seguir los **11 pasos de esta guía** para exponerlo como variable especial

**Coherencia requerida**: Código ↔ MongoDB ↔ librechat.yaml deben estar sincronizados.

---

## 🚀 Workflow de Desarrollo

### Levantar Entorno de Desarrollo

```powershell
# 1. Levantar bases de datos (MongoDB, Redis, Meilisearch)
docker-compose -f deploy-compose-dev.yml up -d

# 2. Iniciar backend (en una terminal)
npm run backend:dev

# 3. Iniciar frontend (en otra terminal)
npm run frontend:dev

# 4. Editar código
# Los cambios en JS se ven automáticamente (nodemon)

# 5. Si modificas TypeScript en packages/
cd packages/data-schemas
npm run build
# Nodemon reiniciará el backend automáticamente

# 6. Si modificas librechat.yaml
# Nodemon detecta cambios y reinicia automáticamente
```

**✅ Hot Reload**: 
- Backend: nodemon detecta cambios en `.js` y `librechat.yaml`
- Frontend: Vite recarga automáticamente
- Packages TypeScript: requieren compilación manual (`npm run build`)

---

---

## 📋 Checklist de Implementación (11 pasos)

### 🔵 PASO 0: Preparación (Agregar Campo al Sistema)

**⚠️ IMPORTANTE**: Antes de seguir los pasos 1-11, si vas a agregar un campo NUEVO que no existe:

#### A. Modificar Schema de MongoDB

**Archivo**: `packages/data-schemas/src/schema/aviRol.ts`

```typescript
const aviRolSchema = new Schema({
  name: { type: String, required: true, unique: true },
  knowledge: { type: String, maxlength: 10000 },
  behavior: { type: String, maxlength: 10000 },
  // ✅ AGREGAR: Nuevo campo
  NOMBRE_CAMPO: { type: String, maxlength: 10000 },  // Ajustar tipo y validaciones
  // ... otros campos
});
```

**Archivo**: `packages/data-schemas/src/schema/aviSubrol.ts` (si aplica)

```typescript
const aviSubrolSchema = new Schema({
  name: { type: String, required: true },
  aviRol_id: { type: Schema.Types.ObjectId, ref: 'AviRol', required: true },
  // ✅ AGREGAR: Nuevo campo (si los subroles también lo necesitan)
  NOMBRE_CAMPO: { type: String, maxlength: 10000 },
  // ... otros campos
});
```

#### B. Agregar Campo a librechat.yaml

**Archivo**: `librechat.yaml`

```yaml
aviRoles:
  roles:
    - name: Roles_AVI
      knowledge: "Conocimiento para usuarios AVI"
      behavior: "Tono: Amable, orientado a cuidado de niños."
      NOMBRE_CAMPO: "Valor del nuevo campo"  # ✅ AGREGAR
      subroles:
        - Cuidador
```

#### C. Modificar Script de Carga

**Archivo**: `scripts/reload-avi-roles.sh`

Buscar donde se crea/actualiza el rol y agregar el nuevo campo:

```javascript
const rolData = {
  name: rol.name,
  knowledge: rol.knowledge || null,
  behavior: rol.behavior || null,
  // ✅ AGREGAR: Nuevo campo
  NOMBRE_CAMPO: rol.NOMBRE_CAMPO || null,
};

await AviRol.findOneAndUpdate(
  { name: rol.name },
  rolData,
  { upsert: true, new: true }
);
```

**📌 Nota**: El script `scripts/reload-avi-roles.sh` es el oficial para Docker y producción.

#### D. Recargar Roles en MongoDB

```powershell
# Desarrollo local (via Docker)
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"

# O directamente en el contenedor
docker exec -it LibreChat-API sh
./scripts/reload-avi-roles.sh -i
```

**✅ Verificar**: El nuevo campo existe en MongoDB con valores de `librechat.yaml`

**Ahora sí, continúa con los Pasos 1-11 para exponer el campo como variable especial.**

---

### ✅ PASO 1: Definir Variables en Data Provider

**Archivo**: `packages/data-provider/src/config.ts`

**Acción**: Agregar nuevas variables al objeto `specialVariables`

```typescript
export const specialVariables = {
  // ... variables existentes ...
  user_avi_rol_NOMBRE_CAMPO: true,      // ✅ Variable para aviRol
  user_avi_subrol_NOMBRE_CAMPO: true,   // ✅ Variable para aviSubrol (si aplica)
};
```

**📌 Regla**: Por cada campo en MongoDB → crear 2 variables (una para rol, otra para subrol)

---

### ✅ PASO 2: Extender Tipos TypeScript

**Archivo**: `packages/data-provider/src/types.ts`

**Acción**: Agregar campos opcionales al tipo `TUser`

```typescript
export type TUser = {
  // ... tipos existentes ...
  aviRolNombreCampo?: string | null;      // ✅ Usar camelCase
  aviSubrolNombreCampo?: string | null;   // ✅ Usar camelCase
};
```

**📌 Regla**: Usar `string | null` para campos opcionales, `string` para obligatorios

---

### ✅ PASO 3: Implementar Reemplazo de Variables

**Archivo**: `packages/data-provider/src/parsers.ts`

**Función**: `replaceSpecialVars()`

**Acción**: Agregar bloques de reemplazo para cada variable

```typescript
export function replaceSpecialVars({ text, user }) {
  let result = text;
  
  // ... reemplazos existentes ...
  
  // ✅ AGREGAR: Reemplazo para aviRol
  if (user && user.aviRolNombreCampo) {
    result = result.replace(/{{user_avi_rol_NOMBRE_CAMPO}}/gi, user.aviRolNombreCampo);
  } else {
    result = result.replace(/{{user_avi_rol_NOMBRE_CAMPO}}/gi, '');
  }

  // ✅ AGREGAR: Reemplazo para aviSubrol
  if (user && user.aviSubrolNombreCampo) {
    result = result.replace(/{{user_avi_subrol_NOMBRE_CAMPO}}/gi, user.aviSubrolNombreCampo);
  } else {
    result = result.replace(/{{user_avi_subrol_NOMBRE_CAMPO}}/gi, '');
  }
  
  return result;
}
```

**📌 Regla**: 
- Variable en `{{}}` usa snake_case
- Propiedad del objeto usa camelCase
- Siempre incluir fallback a string vacío (`''`)

---

### ✅ PASO 4: Compilar Data Provider

**Comando**:
```powershell
cd packages/data-provider; npm run build; cd ../..
```

**✅ Verificar**: Sin errores de TypeScript

---

### ✅ PASO 5: Modificar Populate en Data Schemas

**Archivo**: `packages/data-schemas/src/methods/user.ts`

**Ubicación 1**: Método `getUserWithAviRoles()` (línea ~331)

```typescript
// ❌ ANTES
.populate('aviRol_id', 'name knowledge behavior')

// ✅ DESPUÉS - Agregar el nuevo campo
.populate('aviRol_id', 'name knowledge behavior NOMBRE_CAMPO')
```

**Ubicación 2**: Método `getUsersByAviRole()` (línea ~360)

```typescript
// ❌ ANTES
.populate('aviSubrol_id', 'name knowledge behavior')

// ✅ DESPUÉS - Agregar el nuevo campo
.populate('aviSubrol_id', 'name knowledge behavior NOMBRE_CAMPO')
```

**⚠️ CRÍTICO**: Modificar AMBOS métodos

**📌 Regla**: El nombre del campo debe coincidir EXACTAMENTE con el schema de MongoDB

---

### ✅ PASO 6: Compilar Data Schemas

**Comando**:
```powershell
cd packages/data-schemas; npm run build; cd ../..
```

**✅ Verificar**: Sin errores de compilación

---

### ✅ PASO 7: Extraer Campos en Agent Endpoint

**Archivo**: `api/server/services/Endpoints/agents/agent.js`

**Ubicación**: Buscar el bloque `if (populatedUser)` (línea ~185)

**Acción**: Agregar extracción de nuevos campos

```javascript
if (populatedUser) {
  userWithRoles = {
    ...req.user,
    aviRol: populatedUser.aviRol_id?.name || '',
    aviSubrol: populatedUser.aviSubrol_id?.name || '',
    // ... campos existentes ...
    
    // ✅ AGREGAR: Extraer nuevos campos
    aviRolNombreCampo: populatedUser.aviRol_id?.NOMBRE_CAMPO || null,
    aviSubrolNombreCampo: populatedUser.aviSubrol_id?.NOMBRE_CAMPO || null,
  };
}
```

**📌 Regla**: 
- Propiedad en `userWithRoles`: camelCase (ej: `aviRolNombreCampo`)
- Campo en MongoDB: como esté en schema (ej: `NOMBRE_CAMPO`)
- Usar `|| null` para opcionales, `|| ''` para strings requeridos
- Los nombres deben coincidir con `types.ts` (Paso 2)

---

### ✅ PASO 8: Agregar Traducciones (Inglés)

**Archivo**: `client/src/locales/en/translation.json`

**Acción**: Agregar keys de traducción

```json
{
  "com_ui_special_var_user_avi_rol_NOMBRE_CAMPO": "User AVI Role [Descripción]",
  "com_ui_special_var_user_avi_subrol_NOMBRE_CAMPO": "User AVI Subrole [Descripción]"
}
```

**📌 Regla**: Formato de key = `com_ui_special_var_{nombre_variable}`

---

### ✅ PASO 9: Agregar Traducciones (Español)

**Archivo**: `client/src/locales/es/translation.json`

**Acción**: Agregar keys de traducción

```json
{
  "com_ui_special_var_user_avi_rol_NOMBRE_CAMPO": "[Descripción] del Rol AVI",
  "com_ui_special_var_user_avi_subrol_NOMBRE_CAMPO": "[Descripción] del Subrol AVI"
}
```

---

### ✅ PASO 10: Reiniciar Servicios

**Desarrollo Local**:
```powershell
# Backend (en una terminal)
npm run backend:dev

# Frontend (en otra terminal)
npm run frontend:dev
```

**Docker**:
```powershell
docker-compose -f deploy-compose.yml build api
docker-compose -f deploy-compose.yml up -d api
docker-compose -f deploy-compose.yml logs -f api
```

---

### ✅ PASO 11: Probar en Agente

**Crear agente con instrucciones**:
```
Usuario: {{current_user}}
Rol: {{user_avi_rol}}
[Campo Nuevo]: {{user_avi_rol_NOMBRE_CAMPO}}
```

**Verificar**:
- ✅ Variable se reemplaza con valor de MongoDB
- ✅ Si usuario no tiene rol → reemplaza con string vacío
- ✅ Sin errores en consola del navegador
- ✅ Sin errores en logs del backend

---

## 🎯 Resumen de Archivos

### Si el campo YA EXISTE en MongoDB (ej: knowledge, behavior)
| # | Archivo | Acción | Tipo |
|---|---------|--------|------|
| 1 | `packages/data-provider/src/config.ts` | Agregar variable a objeto | TypeScript |
| 2 | `packages/data-provider/src/types.ts` | Agregar propiedad a TUser | TypeScript |
| 3 | `packages/data-provider/src/parsers.ts` | Agregar bloque de reemplazo | TypeScript |
| 4 | `packages/data-schemas/src/methods/user.ts` | Modificar populate (2 lugares) | TypeScript |
| 5 | `api/server/services/Endpoints/agents/agent.js` | Extraer campo en userWithRoles | JavaScript |
| 6 | `client/src/locales/en/translation.json` | Agregar traducción EN | JSON |
| 7 | `client/src/locales/es/translation.json` | Agregar traducción ES | JSON |

### Si el campo NO EXISTE (campo nuevo)
| # | Archivo | Acción | Tipo |
|---|---------|--------|------|
| 0A | `packages/data-schemas/src/schema/aviRol.ts` | Agregar campo al schema | TypeScript |
| 0B | `librechat.yaml` | Agregar campo a configuración | YAML |
| 0C | `scripts/reload-avi-roles.sh` | Leer y cargar nuevo campo | Shell Script |
| 0D | Ejecutar `docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"` | Cargar a MongoDB | Comando |
| 1-7 | (Seguir tabla anterior) | Exponer como variable especial | Mix |

---

## 📐 Patrón de Nombres (Muy Importante)

### Si el campo en MongoDB se llama: `description`

| Ubicación | Formato | Ejemplo |
|-----------|---------|---------|
| MongoDB schema | snake_case o camelCase | `description` |
| Variable en prompt | snake_case con prefijo | `{{user_avi_rol_description}}` |
| Propiedad en TUser | camelCase con prefijo | `aviRolDescription` |
| Propiedad en userWithRoles | camelCase con prefijo | `aviRolDescription` |
| Key de traducción | snake_case con prefijo | `com_ui_special_var_user_avi_rol_description` |

**Regla Mnemotécnica**: 
- **Dentro de código** → camelCase
- **En plantillas/configs** → snake_case

---

## ⚠️ Puntos Críticos (NO OLVIDAR)

### 1. Compilación Obligatoria
```powershell
# SIEMPRE compilar después de cambios en packages
cd packages/data-provider; npm run build; cd ../..
cd packages/data-schemas; npm run build; cd ../..
```

### 2. Dos Lugares en user.ts
- ✅ `getUserWithAviRoles()` (línea ~331)
- ✅ `getUsersByAviRole()` (línea ~360)

### 3. Consistencia de Nombres
```typescript
// Paso 1: config.ts
user_avi_rol_description: true

// Paso 2: types.ts
aviRolDescription?: string | null

// Paso 3: parsers.ts
user.aviRolDescription  // objeto
{{user_avi_rol_description}}  // variable

// Paso 5: user.ts (populate)
.populate('aviRol_id', '... description')

// Paso 7: agent.js
aviRolDescription: populatedUser.aviRol_id?.description || null
```

### 4. Fallback en Reemplazo
```typescript
// ✅ CORRECTO
if (user && user.aviRolCampo) {
  result = result.replace(/{{...}}/gi, user.aviRolCampo);
} else {
  result = result.replace(/{{...}}/gi, '');  // String vacío como fallback
}

// ❌ INCORRECTO (no manejar el else)
if (user && user.aviRolCampo) {
  result = result.replace(/{{...}}/gi, user.aviRolCampo);
}
```

### 5. Tipo de Datos en agent.js
```javascript
// Para strings opcionales
aviRolCampo: populatedUser.aviRol_id?.campo || null

// Para strings requeridos
aviRol: populatedUser.aviRol_id?.name || ''

// Para arrays
aviRolPermisos: populatedUser.aviRol_id?.permisos || []

// Para objetos
aviRolConfig: populatedUser.aviRol_id?.config || {}
```

---

## 🔄 Flujo de Datos Completo

```
┌─────────────────────────────────────────────────────────────┐
│ 1. MongoDB Schema (aviRol collection)                       │
│    Campo: description: { type: String, maxlength: 10000 }   │
└────────────────────────────────┬────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────┐
│ 2. user.ts populate                                         │
│    .populate('aviRol_id', 'name knowledge behavior          │
│              description')  ◄── Agregar aquí                │
└────────────────────────────────┬────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────┐
│ 3. agent.js extracción                                      │
│    aviRolDescription: populatedUser.aviRol_id?.description  │
└────────────────────────────────┬────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────┐
│ 4. types.ts definición                                      │
│    aviRolDescription?: string | null                        │
└────────────────────────────────┬────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────┐
│ 5. parsers.ts reemplazo                                     │
│    {{user_avi_rol_description}} → valor o ''                │
└────────────────────────────────┬────────────────────────────┘
                                 │
┌────────────────────────────────▼────────────────────────────┐
│ 6. Prompt final enviado al modelo LLM                       │
│    "Tu rol tiene esta descripción: [valor de description]"  │
└─────────────────────────────────────────────────────────────┘
```

---

## 📝 Ejemplo Completo: Campo `icon`

### Contexto
Agregar un campo `icon` (string, URL del icono) a aviRol y aviSubrol.

### Implementación

#### 1. config.ts
```typescript
export const specialVariables = {
  // ... existentes ...
  user_avi_rol_icon: true,
  user_avi_subrol_icon: true,
};
```

#### 2. types.ts
```typescript
export type TUser = {
  // ... existentes ...
  aviRolIcon?: string | null;
  aviSubrolIcon?: string | null;
};
```

#### 3. parsers.ts
```typescript
// Reemplazo para aviRol icon
if (user && user.aviRolIcon) {
  result = result.replace(/{{user_avi_rol_icon}}/gi, user.aviRolIcon);
} else {
  result = result.replace(/{{user_avi_rol_icon}}/gi, '');
}

// Reemplazo para aviSubrol icon
if (user && user.aviSubrolIcon) {
  result = result.replace(/{{user_avi_subrol_icon}}/gi, user.aviSubrolIcon);
} else {
  result = result.replace(/{{user_avi_subrol_icon}}/gi, '');
}
```

#### 4. Compilar data-provider
```powershell
cd packages/data-provider; npm run build; cd ../..
```

#### 5. user.ts (2 lugares)
```typescript
// getUserWithAviRoles() - línea ~331
.populate('aviRol_id', 'name knowledge behavior icon')
.populate('aviSubrol_id', 'name knowledge behavior icon')

// getUsersByAviRole() - línea ~360
.populate('aviRol_id', 'name knowledge behavior icon')
.populate('aviSubrol_id', 'name knowledge behavior icon')
```

#### 6. Compilar data-schemas
```powershell
cd packages/data-schemas; npm run build; cd ../..
```

#### 7. agent.js
```javascript
if (populatedUser) {
  userWithRoles = {
    ...req.user,
    aviRol: populatedUser.aviRol_id?.name || '',
    aviSubrol: populatedUser.aviSubrol_id?.name || '',
    // ... existentes ...
    aviRolIcon: populatedUser.aviRol_id?.icon || null,
    aviSubrolIcon: populatedUser.aviSubrol_id?.icon || null,
  };
}
```

#### 8. en/translation.json
```json
{
  "com_ui_special_var_user_avi_rol_icon": "User AVI Role Icon",
  "com_ui_special_var_user_avi_subrol_icon": "User AVI Subrole Icon"
}
```

#### 9. es/translation.json
```json
{
  "com_ui_special_var_user_avi_rol_icon": "Icono del Rol AVI",
  "com_ui_special_var_user_avi_subrol_icon": "Icono del Subrol AVI"
}
```

#### 10. Reiniciar y probar
```powershell
npm run backend:dev
```

#### 11. Probar en agente
```
Icono de tu rol: {{user_avi_rol_icon}}
```

---

## 🚀 Comandos Rápidos (PowerShell)

### Desarrollo Local (Completo)
```powershell
# 1. Levantar bases de datos (MongoDB, Redis, Meilisearch)
docker-compose -f deploy-compose-dev.yml up -d

# 2. Terminal 1: Backend con hot-reload
npm run backend:dev

# 3. Terminal 2: Frontend con hot-reload
npm run frontend:dev

# 4. Si cambias packages TypeScript (nodemon reinicia automáticamente)
cd packages/data-schemas; npm run build; cd ../..
```

### Compilación Packages (Solo si modificas TypeScript)
```powershell
cd packages/data-provider; npm run build; cd ..; cd data-schemas; npm run build; cd ../..
```

### Recargar Roles desde librechat.yaml a MongoDB
```powershell
# Dentro del contenedor Docker (recomendado)
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"

# O entrar al contenedor y ejecutar
docker exec -it LibreChat-API sh
./scripts/reload-avi-roles.sh -i
exit
```

### Docker (Producción)
```powershell
docker-compose -f deploy-compose.yml build api; docker-compose -f deploy-compose.yml up -d api
```

---

## 📚 Documentos de Referencia

- **Implementación real**: `Docs_AVI/IMPLEMENTACION_KNOWLEDGE_BEHAVIOR.md`
- **Configuración roles**: `librechat.yaml` (sección `aviRoles`)
- **Schema aviRol**: `packages/data-schemas/src/schema/aviRol.ts`
- **Schema aviSubrol**: `packages/data-schemas/src/schema/aviSubrol.ts`
- **Métodos user**: `packages/data-schemas/src/methods/user.ts`
- **Script de carga**: `scripts/reload-avi-roles.sh` ⭐ (Oficial)
- **Guía deploy**: `Docs_AVI/GUIA_DEPLOY_DESARROLLO.md`

---

## 🔴 REGLA DE ORO: Coherencia Triple

```
┌─────────────────────────────────────────────────────┐
│  1. librechat.yaml (aviRoles.roles[].CAMPO)         │
│     ↓ leído por scripts/reload-avi-roles.sh         │
│                                                       │
│  2. MongoDB Schema (aviRol.ts / aviSubrol.ts)       │
│     ↓ poblado por getUserWithAviRoles()             │
│                                                       │
│  3. Código Backend (agent.js, parsers.ts, etc.)     │
│     ↓ expuesto como {{user_avi_rol_CAMPO}}          │
│                                                       │
│  ✅ Los 3 niveles deben estar SINCRONIZADOS          │
└─────────────────────────────────────────────────────┘
```

**Ejemplo**: Si agregas `icon` a `librechat.yaml`:
1. ✅ Debe existir en schema MongoDB: `icon: { type: String }`
2. ✅ Debe ser leído por: `scripts/reload-avi-roles.sh`
3. ✅ Debe seguir pasos 1-11 de esta guía

**Sin esta coherencia, el sistema NO funcionará correctamente.**

---
- **Schema aviSubrol**: `packages/data-schemas/src/schema/aviSubrol.ts`
- **Métodos user**: `packages/data-schemas/src/methods/user.ts`
- **Guía deploy**: `Docs_AVI/GUIA_DEPLOY_DESARROLLO.md`

---

## ✅ Checklist de Verificación Final

Antes de considerar la implementación completa:

- [ ] Compiló `packages/data-provider` sin errores
- [ ] Compiló `packages/data-schemas` sin errores
- [ ] Modificó ambos métodos en `user.ts` (getUserWithAviRoles y getUsersByAviRole)
- [ ] Nombres consistentes: config.ts, types.ts, parsers.ts, agent.js
- [ ] Agregó traducciones EN y ES
- [ ] Probó con usuario con roles → muestra valor
- [ ] Probó con usuario sin roles → muestra string vacío
- [ ] Sin errores en consola del navegador
- [ ] Sin errores en logs del backend
- [ ] Variable se reemplaza correctamente en prompt del agente

---

**Versión**: 1.0.0  
**Fecha**: 2025-10-27  
**Mantenedor**: Sistema AVI Roles  
**Estado**: ✅ Listo para uso por agentes inteligentes
