# 🎯 Resumen de Implementación: Variables AVI Roles en Prompts

**Fecha**: 2025-10-04 (Actualizado: 2025-10-21)  
**Branch**: `feat_variables_promt` → `dev_add_knowledge_behavior`  
**Autor**: Implementación de variables `{{user_avi_rol}}` y `{{user_avi_subrol}}`

---

## 📑 Tabla de Contenido

1. [✅ Cambios Implementados](#-cambios-implementados)
2. [📋 Archivos Modificados](#-archivos-modificados)
3. [🎯 Funcionalidad Implementada](#-funcionalidad-implementada)
4. [🔧 Flujo Técnico](#-flujo-técnico)
5. [📝 Ejemplos de Uso](#-ejemplos-de-uso)
6. [🧪 Testing](#-testing)
7. [🚀 Despliegue](#-despliegue)
8. [🔮 Extensibilidad Futura](#-extensibilidad-futura)
9. [🔍 Análisis Profundo: Variables de Contexto Actuales](#-análisis-profundo-variables-de-contexto-actuales)
   - [Arquitectura del Sistema de Variables](#1-arquitectura-del-sistema-de-variables)
   - [CAPA 1: Definición de Variables](#2-capa-1-definición-de-variables-configts)
   - [CAPA 2: Población de Datos](#3-capa-2-población-de-datos-agentjs)
   - [CAPA 3: Reemplazo de Variables](#4-capa-3-reemplazo-de-variables-parsersts)
   - [Ejemplo Completo de Ejecución](#5-ejemplo-completo-de-ejecución)
10. [🚀 Próxima Implementación: Variables de `knowledge` y `behavior`](#-próxima-implementación-variables-de-knowledge-y-behavior)
11. [⚠️ Consideraciones](#️-consideraciones)
12. [📚 Referencias](#-referencias)
13. [✨ Resumen Final](#-resumen-final)

---

## ✅ Cambios Implementados

### 1. **packages/data-provider/src/config.ts**
- ✅ Agregadas variables especiales:
  - `user_avi_rol: true`
  - `user_avi_subrol: true`

### 2. **packages/data-provider/src/parsers.ts**
- ✅ Extendida función `replaceSpecialVars` para soportar:
  - `{{user_avi_rol}}` → Reemplaza con `user.aviRol` (string)
  - `{{user_avi_subrol}}` → Reemplaza con `user.aviSubrol` (string)
  - Retorna string vacío si no hay rol/subrol asignado

### 3. **packages/data-provider/src/types.ts**
- ✅ Agregados campos al tipo `TUser`:
  - `aviRol?: string`
  - `aviSubrol?: string`

### 4. **api/server/services/Endpoints/agents/agent.js**
- ✅ Importado `getUserWithAviRoles` desde `~/models`
- ✅ Implementada lógica para poblar roles antes de reemplazar variables:
  - Si usuario tiene `aviRol_id` o `aviSubrol_id`, hace populate
  - Extrae el campo `name` de cada rol/subrol poblado
  - Crea objeto `userWithRoles` con los campos string
  - Pasa el objeto a `replaceSpecialVars`

### 5. **Documentación**
- ✅ Creado `VARIABLES_AVI_ROLES.md` con:
  - Descripción completa de las variables
  - Ejemplos de uso
  - Notas técnicas
  - Guía de despliegue

### 6. **Script de Prueba**
- ✅ Creado `config/test-avi-roles-variables.js` que prueba:
  - Usuario con rol administrativo y subrol Gestor de Usuarios
  - Usuario con rol cuidador y subrol Cuidador Principal
  - Usuario sin roles asignados

---

## 📋 Archivos Modificados

```
packages/data-provider/src/
  ├── config.ts                    [MODIFICADO]
  ├── parsers.ts                   [MODIFICADO]
  └── types.ts                     [MODIFICADO]

api/server/services/Endpoints/agents/
  └── agent.js                     [MODIFICADO]

config/
  └── test-avi-roles-variables.js  [NUEVO]

VARIABLES_AVI_ROLES.md             [NUEVO]
IMPLEMENTACION_VARIABLES_AVI.md    [NUEVO - Este archivo]
```

---

## 🎯 Funcionalidad Implementada

### Variables Especiales Nuevas

#### `{{user_avi_rol}}`
- **Descripción**: Retorna el nombre del rol AVI del usuario
- **Valores**: `generico`, `cuidador`, `administrativo`, o `` (vacío)
- **Tipo**: String

#### `{{user_avi_subrol}}`
- **Descripción**: Retorna el nombre del subrol AVI del usuario
- **Valores**: Depende del rol padre (ver documentación)
- **Tipo**: String

### Comportamiento

1. **Con roles asignados**: Las variables se reemplazan con el nombre (`name`) del rol/subrol
2. **Sin roles asignados**: Las variables se reemplazan con string vacío `""`
3. **Error al poblar**: Si falla el populate, continúa con roles vacíos (no interrumpe)

---

## 🔧 Flujo Técnico

```
1. Usuario hace request a endpoint de agentes
   ↓
2. Middleware JWT autentica usuario → req.user
   ↓
3. En agent.js, se detecta si hay instrucciones
   ↓
4. Si req.user tiene aviRol_id o aviSubrol_id:
   ├── Se llama getUserWithAviRoles(userId)
   ├── Se hace populate de aviRol_id y aviSubrol_id
   ├── Se extraen los campos .name de cada uno
   └── Se crea userWithRoles con aviRol y aviSubrol como strings
   ↓
5. Se llama replaceSpecialVars({ text, user: userWithRoles })
   ↓
6. La función busca {{user_avi_rol}} y {{user_avi_subrol}}
   ↓
7. Reemplaza con user.aviRol y user.aviSubrol respectivamente
   ↓
8. Retorna texto con variables reemplazadas
```

---

## 📝 Ejemplos de Uso

### Ejemplo Simple
```
Hola {{current_user}}, tu rol es {{user_avi_rol}}.
```

**Entrada**: Usuario "Juan" con rol "administrativo"  
**Salida**: `Hola Juan, tu rol es administrativo.`

### Ejemplo Completo
```
Usuario: {{current_user}}
Rol: {{user_avi_rol}}
Subrol: {{user_avi_subrol}}
Fecha: {{current_date}}

Como {{user_avi_subrol}}, puedes realizar las siguientes acciones...
```

**Entrada**: Usuario "María" con rol "cuidador" y subrol "Cuidador Principal"  
**Salida**:
```
Usuario: María
Rol: cuidador
Subrol: Cuidador Principal
Fecha: 2025-10-04 (6)

Como Cuidador Principal, puedes realizar las siguientes acciones...
```

---

## 🧪 Testing

### Ejecutar Tests
```bash
# Asegúrate de estar en la raíz del proyecto
node config/test-avi-roles-variables.js
```

### Tests Incluidos
1. ✅ Usuario con rol administrativo y subrol Gestor de Usuarios
2. ✅ Usuario con rol cuidador y subrol Cuidador Principal
3. ✅ Usuario sin roles (variables vacías)

### Resultado Esperado
- Variables se reemplazan correctamente con los nombres
- Strings vacíos cuando no hay roles
- No hay errores en el proceso

---

## 🚀 Despliegue

### Desarrollo Local
```bash
# Instalar dependencias
npm install

# Compilar packages
cd packages/data-provider && npm run build && cd ../..

# Iniciar servidor
npm run backend
```

### Docker (Producción)
```bash
# Reconstruir imagen
docker-compose -f deploy-compose.yml build api

# Reiniciar contenedor
docker-compose -f deploy-compose.yml up -d api

# Ver logs
docker-compose -f deploy-compose.yml logs -f api
```

### Verificar Compilación
Los cambios en `packages/data-provider` se compilan en la etapa `data-provider-build` del Dockerfile.multi

---

## 🔮 Extensibilidad Futura

Si en el futuro se agregan más campos a las colecciones `aviRol` o `aviSubrol` (por ejemplo, `conocimiento`, `descripcion`, etc.), el sistema puede extenderse fácilmente:

### Opción 1: Mantener variables actuales + Agregar nuevas
```typescript
// Actuales (retornan .name por defecto)
{{user_avi_rol}}       → aviRol.name
{{user_avi_subrol}}    → aviSubrol.name

// Nuevas (específicas por campo - SIGUIENTE IMPLEMENTACIÓN)
{{user_avi_rol_knowledge}}    → aviRol.knowledge
{{user_avi_rol_behavior}}     → aviRol.behavior
{{user_avi_subrol_knowledge}} → aviSubrol.knowledge (siempre null en Opción 1)
{{user_avi_subrol_behavior}}  → aviSubrol.behavior (siempre null en Opción 1)
```

### Cambios Necesarios
1. Agregar campos al tipo `TUser` en `types.ts`
2. Extender lógica de populate en `agent.js` para extraer más campos
3. Agregar patrones de reemplazo en `replaceSpecialVars` en `parsers.ts`
4. Agregar a `specialVariables` en `config.ts`

---

## 🔍 Análisis Profundo: Variables de Contexto Actuales

### **1. Arquitectura del Sistema de Variables**

El sistema de variables de contexto está implementado en 3 capas:

```
┌─────────────────────────────────────────────────────────┐
│  CAPA 1: DEFINICIÓN (config.ts)                         │
│  Define qué variables están disponibles                 │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  CAPA 2: POBLACIÓN (agent.js)                           │
│  Obtiene datos de MongoDB y prepara objeto user         │
└─────────────────────────────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│  CAPA 3: REEMPLAZO (parsers.ts)                         │
│  Reemplaza placeholders con valores reales              │
└─────────────────────────────────────────────────────────┘
```

---

### **2. CAPA 1: Definición de Variables (`config.ts`)**

**Ubicación**: `packages/data-provider/src/config.ts`

```typescript
export const specialVariables = {
  current_user: true,
  current_date: true,
  current_datetime: true,
  iso_datetime: true,
  user_avi_rol: true,      // ✅ Variable AVI Rol
  user_avi_subrol: true,    // ✅ Variable AVI Subrol
};
```

**Propósito:**
- Define el catálogo de variables especiales disponibles
- Se usa para validación y autocompletado en el editor
- Las variables con `true` están habilitadas

---

### **3. CAPA 2: Población de Datos (`agent.js`)**

**Ubicación**: `api/server/services/Endpoints/agents/agent.js` (líneas 185-208)

#### **Flujo de Población:**

```javascript
// PASO 1: Detectar si el usuario tiene roles AVI asignados
if (req.user && (req.user.aviRol_id || req.user.aviSubrol_id)) {
  
  // PASO 2: Hacer populate de los roles desde MongoDB
  const populatedUser = await getUserWithAviRoles(req.user.id || req.user._id);
  
  // PASO 3: Extraer SOLO el campo .name de cada rol poblado
  if (populatedUser) {
    userWithRoles = {
      ...req.user,
      aviRol: populatedUser.aviRol_id?.name || '',      // String: "Admin", "Cuidador", etc.
      aviSubrol: populatedUser.aviSubrol_id?.name || '', // String: "Programador", etc.
    };
  }
}

// PASO 4: Pasar el objeto preparado a replaceSpecialVars
agent.instructions = replaceSpecialVars({
  text: agent.instructions,
  user: userWithRoles,
});
```

#### **Detalles Técnicos:**

**Función `getUserWithAviRoles()`:**
- **Ubicación**: `api/models/User.js` (método exportado desde `~/models`)
- **Acción**: Hace `.populate('aviRol_id aviSubrol_id')` en el documento User
- **Retorna**: Usuario con `aviRol_id` y `aviSubrol_id` poblados (objetos completos)

**Transformación de Datos:**
```javascript
// MongoDB (antes de transformar)
{
  _id: ObjectId("..."),
  name: "Juan",
  aviRol_id: {
    _id: ObjectId("68e601c1..."),
    name: "Admin",
    knowledge: "Conocimiento técnico avanzado...",
    behavior: "Ético, responsable...",
    createdAt: ISODate("..."),
    updatedAt: ISODate("...")
  },
  aviSubrol_id: {
    _id: ObjectId("68f2a1b3..."),
    name: "Programador",
    parentRolId: ObjectId("68e601c1..."),
    knowledge: null,
    behavior: null,
    createdAt: ISODate("..."),
    updatedAt: ISODate("...")
  }
}

// Objeto userWithRoles (después de transformar)
{
  _id: "...",
  name: "Juan",
  aviRol: "Admin",           // ✅ SOLO el nombre (String)
  aviSubrol: "Programador"   // ✅ SOLO el nombre (String)
}
```

**¿Por qué solo extraemos `.name`?**
- ✅ **Simplicidad**: Las variables actuales solo necesitan el nombre
- ✅ **Retrocompatibilidad**: No rompe código existente
- ✅ **Rendimiento**: Objeto más liviano para pasar al parser
- ⚠️ **Limitación**: No se pueden usar otros campos (`knowledge`, `behavior`) en esta versión

---

### **4. CAPA 3: Reemplazo de Variables (`parsers.ts`)**

**Ubicación**: `packages/data-provider/src/parsers.ts` (función `replaceSpecialVars`, líneas 413-450)

#### **Algoritmo de Reemplazo:**

```typescript
export function replaceSpecialVars({ text, user }: { text: string; user?: TUser | null }) {
  let result = text;
  
  // Guard clause: Si no hay texto, retornar inmediatamente
  if (!result) {
    return result;
  }

  // 1. Variables de fecha/hora (sin dependencia del usuario)
  const currentDate = dayjs().format('YYYY-MM-DD');
  const dayNumber = dayjs().day();
  const combinedDate = `${currentDate} (${dayNumber})`;
  result = result.replace(/{{current_date}}/gi, combinedDate);
  
  const currentDatetime = dayjs().format('YYYY-MM-DD HH:mm:ss');
  result = result.replace(/{{current_datetime}}/gi, `${currentDatetime} (${dayNumber})`);
  
  const isoDatetime = dayjs().toISOString();
  result = result.replace(/{{iso_datetime}}/gi, isoDatetime);

  // 2. Variable de usuario (requiere user.name)
  if (user && user.name) {
    result = result.replace(/{{current_user}}/gi, user.name);
  }

  // 3. ✅ Variables AVI Rol (requiere user.aviRol)
  if (user && user.aviRol) {
    result = result.replace(/{{user_avi_rol}}/gi, user.aviRol);
  } else {
    result = result.replace(/{{user_avi_rol}}/gi, ''); // String vacío si no hay rol
  }

  // 4. ✅ Variables AVI Subrol (requiere user.aviSubrol)
  if (user && user.aviSubrol) {
    result = result.replace(/{{user_avi_subrol}}/gi, user.aviSubrol);
  } else {
    result = result.replace(/{{user_avi_subrol}}/gi, ''); // String vacío si no hay subrol
  }

  return result;
}
```

#### **Características del Reemplazo:**

| Característica | Descripción |
|----------------|-------------|
| **Case-insensitive** | `/gi` permite `{{USER_AVI_ROL}}`, `{{User_Avi_Rol}}`, etc. |
| **Múltiples ocurrencias** | Reemplaza todas las apariciones en el texto |
| **Fallback a vacío** | Si no hay valor, reemplaza con `""` (no `null` ni `undefined`) |
| **Orden de ejecución** | Secuencial: fecha → usuario → rol → subrol |

---

### **5. Ejemplo Completo de Ejecución**

#### **Escenario: Usuario con Rol Admin y Subrol Programador**

**ENTRADA (Instrucciones del Agente):**
```
Hola {{current_user}}, tu rol es {{user_avi_rol}} con especialización en {{user_avi_subrol}}.

Como {{user_avi_rol}}, tienes acceso completo al sistema.
Fecha de consulta: {{current_date}}
```

**PASO 1: Objeto User en MongoDB**
```javascript
{
  _id: ObjectId("68f5a1b3c4d5e6f7a8b9c0d1"),
  name: "Juan Pérez",
  email: "juan@example.com",
  aviRol_id: ObjectId("68e601c1e111faccaabc0308"),  // ← Referencia a Admin
  aviSubrol_id: ObjectId("68f2a1b3c4d5e6f7a8b9c0d2") // ← Referencia a Programador
}
```

**PASO 2: Población con `getUserWithAviRoles()`**
```javascript
{
  _id: ObjectId("68f5a1b3c4d5e6f7a8b9c0d1"),
  name: "Juan Pérez",
  aviRol_id: {
    _id: ObjectId("68e601c1e111faccaabc0308"),
    name: "Admin",
    knowledge: "Conocimiento técnico avanzado en sistemas...",
    behavior: "Ético, responsable, transparente..."
  },
  aviSubrol_id: {
    _id: ObjectId("68f2a1b3c4d5e6f7a8b9c0d2"),
    name: "Programador",
    parentRolId: ObjectId("68e601c1e111faccaabc0308"),
    knowledge: null,
    behavior: null
  }
}
```

**PASO 3: Transformación a `userWithRoles`**
```javascript
{
  _id: "68f5a1b3c4d5e6f7a8b9c0d1",
  name: "Juan Pérez",
  aviRol: "Admin",           // ✅ Extraído de aviRol_id.name
  aviSubrol: "Programador"   // ✅ Extraído de aviSubrol_id.name
}
```

**PASO 4: Reemplazo en `replaceSpecialVars()`**
```
Hola Juan Pérez, tu rol es Admin con especialización en Programador.

Como Admin, tienes acceso completo al sistema.
Fecha de consulta: 2025-10-21 (1)
```

**SALIDA FINAL:**
El agente recibe las instrucciones con todas las variables reemplazadas y puede usar ese contexto para responder de forma personalizada.

---

## 🚀 Próxima Implementación: Variables de `knowledge` y `behavior`

### **Objetivo:**
Exponer los campos `knowledge` y `behavior` de los roles AVI como variables de contexto para que los agentes puedan acceder al conocimiento esperado y comportamiento definido del usuario.

### **Nuevas Variables Propuestas:**

```typescript
{{user_avi_rol_knowledge}}    → aviRol.knowledge (String | null)
{{user_avi_rol_behavior}}     → aviRol.behavior (String | null)
{{user_avi_subrol_knowledge}} → aviSubrol.knowledge (null en Opción 1)
{{user_avi_subrol_behavior}}  → aviSubrol.behavior (null en Opción 1)
```

### **Casos de Uso:**

#### **Ejemplo 1: Prompts Adaptativos por Conocimiento**
```
Hola {{current_user}}, 

Tu rol es {{user_avi_rol}} con el siguiente conocimiento esperado:
{{user_avi_rol_knowledge}}

Como agente, adaptaré mi vocabulario y profundidad técnica según tu nivel de conocimiento.
```

**Salida para Admin:**
```
Hola Juan Pérez,

Tu rol es Admin con el siguiente conocimiento esperado:
Conocimiento técnico avanzado en sistemas, bases de datos y gestión de plataformas

Como agente, adaptaré mi vocabulario y profundidad técnica según tu nivel de conocimiento.
```

#### **Ejemplo 2: Guías de Comportamiento**
```
Recordatorio de comportamiento esperado para {{user_avi_rol}}:
{{user_avi_rol_behavior}}

Por favor, mantén este estándar durante la interacción.
```

**Salida para Cuidador:**
```
Recordatorio de comportamiento esperado para Cuidador:
Responsable, atento, proactivo en la protección y cuidado de niños

Por favor, mantén este estándar durante la interacción.
```

### **Implementación Requerida:**

#### **1. Modificar `agent.js` (Población de Datos)**

```javascript
// ACTUAL (líneas 185-208)
userWithRoles = {
  ...req.user,
  aviRol: populatedUser.aviRol_id?.name || '',
  aviSubrol: populatedUser.aviSubrol_id?.name || '',
};

// PROPUESTA (agregar campos knowledge y behavior)
userWithRoles = {
  ...req.user,
  aviRol: populatedUser.aviRol_id?.name || '',
  aviSubrol: populatedUser.aviSubrol_id?.name || '',
  aviRolKnowledge: populatedUser.aviRol_id?.knowledge || null,    // ✅ NUEVO
  aviRolBehavior: populatedUser.aviRol_id?.behavior || null,      // ✅ NUEVO
  aviSubrolKnowledge: populatedUser.aviSubrol_id?.knowledge || null, // ✅ NUEVO
  aviSubrolBehavior: populatedUser.aviSubrol_id?.behavior || null,   // ✅ NUEVO
};
```

#### **2. Modificar `types.ts` (Definición de Tipos)**

```typescript
// ACTUAL (packages/data-provider/src/types.ts)
export interface TUser {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  aviRol?: string;
  aviSubrol?: string;
}

// PROPUESTA (agregar campos knowledge y behavior)
export interface TUser {
  id: string;
  username: string;
  email: string;
  name: string;
  avatar?: string;
  aviRol?: string;
  aviSubrol?: string;
  aviRolKnowledge?: string | null;    // ✅ NUEVO
  aviRolBehavior?: string | null;     // ✅ NUEVO
  aviSubrolKnowledge?: string | null; // ✅ NUEVO
  aviSubrolBehavior?: string | null;  // ✅ NUEVO
}
```

#### **3. Modificar `parsers.ts` (Reemplazo de Variables)**

```typescript
// ACTUAL (función replaceSpecialVars, líneas 413-450)
if (user && user.aviRol) {
  result = result.replace(/{{user_avi_rol}}/gi, user.aviRol);
} else {
  result = result.replace(/{{user_avi_rol}}/gi, '');
}

if (user && user.aviSubrol) {
  result = result.replace(/{{user_avi_subrol}}/gi, user.aviSubrol);
} else {
  result = result.replace(/{{user_avi_subrol}}/gi, '');
}

// PROPUESTA (agregar reemplazos para knowledge y behavior)
// ... código anterior ...

// Variables AVI Rol Knowledge
if (user && user.aviRolKnowledge) {
  result = result.replace(/{{user_avi_rol_knowledge}}/gi, user.aviRolKnowledge);
} else {
  result = result.replace(/{{user_avi_rol_knowledge}}/gi, '');
}

// Variables AVI Rol Behavior
if (user && user.aviRolBehavior) {
  result = result.replace(/{{user_avi_rol_behavior}}/gi, user.aviRolBehavior);
} else {
  result = result.replace(/{{user_avi_rol_behavior}}/gi, '');
}

// Variables AVI Subrol Knowledge (siempre null en Opción 1)
if (user && user.aviSubrolKnowledge) {
  result = result.replace(/{{user_avi_subrol_knowledge}}/gi, user.aviSubrolKnowledge);
} else {
  result = result.replace(/{{user_avi_subrol_knowledge}}/gi, '');
}

// Variables AVI Subrol Behavior (siempre null en Opción 1)
if (user && user.aviSubrolBehavior) {
  result = result.replace(/{{user_avi_subrol_behavior}}/gi, user.aviSubrolBehavior);
} else {
  result = result.replace(/{{user_avi_subrol_behavior}}/gi, '');
}
```

#### **4. Modificar `config.ts` (Definición de Variables)**

```typescript
// ACTUAL (packages/data-provider/src/config.ts)
export const specialVariables = {
  current_user: true,
  current_date: true,
  current_datetime: true,
  iso_datetime: true,
  user_avi_rol: true,
  user_avi_subrol: true,
};

// PROPUESTA (agregar nuevas variables)
export const specialVariables = {
  current_user: true,
  current_date: true,
  current_datetime: true,
  iso_datetime: true,
  user_avi_rol: true,
  user_avi_subrol: true,
  user_avi_rol_knowledge: true,    // ✅ NUEVO
  user_avi_rol_behavior: true,     // ✅ NUEVO
  user_avi_subrol_knowledge: true, // ✅ NUEVO
  user_avi_subrol_behavior: true,  // ✅ NUEVO
};
```

### **Consideraciones Técnicas:**

#### **Rendimiento:**
- ✅ **Sin impacto adicional**: El populate ya trae los objetos completos, solo extraemos más campos
- ✅ **Caching**: No cambia la estrategia de caching actual
- ✅ **Lazy loading**: Solo se puebla si el usuario tiene `aviRol_id` o `aviSubrol_id`

#### **Seguridad:**
- ✅ **Datos no sensibles**: `knowledge` y `behavior` son descriptores generales, no información privada
- ✅ **Control de acceso**: Los roles ya están validados por el sistema ACL
- ⚠️ **Longitud de campos**: Máximo 10,000 caracteres (ya definido en schema)

#### **Compatibilidad:**
- ✅ **Retrocompatible**: Variables actuales siguen funcionando igual
- ✅ **Fallback a vacío**: Si el campo es `null`, se reemplaza con `""`
- ✅ **Opción 1 respetada**: Subroles siempre retornarán `""` para `knowledge` y `behavior`

### **Beneficios de la Implementación:**

1. **Prompts más contextuales**: Los agentes pueden adaptar su lenguaje según el conocimiento esperado del usuario
2. **Guías de comportamiento**: Recordatorios automáticos del comportamiento esperado por rol
3. **Onboarding dinámico**: Instrucciones personalizadas según el nivel de conocimiento
4. **Auditoría mejorada**: Logs con contexto completo del rol y conocimientos esperados
5. **Extensibilidad**: Base para futuras variables (ej: `{{user_avi_rol_permissions}}`)

### **Próximos Pasos:**

1. ✅ **Fase 1 (COMPLETADA)**: Variables `{{user_avi_rol}}` y `{{user_avi_subrol}}`
2. 🔜 **Fase 2 (SIGUIENTE)**: Variables `{{user_avi_rol_knowledge}}` y `{{user_avi_rol_behavior}}`
3. 🔮 **Fase 3 (FUTURO)**: Variables de permisos, fechas de asignación, etc.

---

**Nota**: Esta implementación está diseñada para ser **no invasiva** y **totalmente retrocompatible** con el sistema actual. Los cambios se limitan a 4 archivos y no afectan la estructura de datos existente en MongoDB.

---

## ⚠️ Consideraciones

### Rendimiento
- El populate de roles solo se hace si las variables están presentes en las instrucciones
- Si el populate falla, continúa con valores vacíos (no bloquea)
- Cache de usuario no incluye roles poblados (se hace on-demand)

### Seguridad
- Los nombres de roles son strings simples, sin información sensible
- No se exponen IDs de roles en las variables
- Los roles siguen el sistema de permisos ACL existente

### Compatibilidad
- ✅ Compatible con variables existentes: `{{current_user}}`, `{{current_date}}`, etc.
- ✅ No rompe prompts existentes sin las nuevas variables
- ✅ Retrocompatible con usuarios sin roles AVI

---

## 📚 Referencias

- **Sistema AVI Roles**: `DOCUMENTACION_AVI_ROLES.md`, `AVI_ROLES_DOCUMENTATION.md`
- **Variables Prompts**: Documentación original de variables especiales
- **Schemas**: `packages/data-schemas/src/schema/aviRol.ts`, `aviSubrol.ts`
- **Métodos**: `packages/data-schemas/src/methods/user.ts` → `getUserWithAviRoles`

---

## ✨ Resumen Final

### ✅ Lo que se implementó (Fase 1):
✅ 2 nuevas variables especiales: `{{user_avi_rol}}` y `{{user_avi_subrol}}`  
✅ Sistema de populate automático en `agent.js`  
✅ Reemplazo con nombres de roles (no IDs ni objetos)  
✅ Strings vacíos cuando no hay roles  
✅ Documentación técnica completa  
✅ Script de prueba funcional  
✅ Sistema extensible para futuros campos  
✅ Análisis profundo de arquitectura de 3 capas  
✅ Ejemplos detallados con flujos completos  

### 🚀 Listo para:
✅ Compilación en Docker  
✅ Despliegue en producción  
✅ Testing con usuarios reales  
✅ **Fase 2: Implementación de variables `knowledge` y `behavior`**  

### � Próxima Implementación (Fase 2):

**Objetivo**: Exponer campos `knowledge` y `behavior` de roles AVI como variables de contexto

**Nuevas Variables a Implementar**:
- `{{user_avi_rol_knowledge}}` → Conocimiento esperado del rol
- `{{user_avi_rol_behavior}}` → Comportamiento esperado del rol
- `{{user_avi_subrol_knowledge}}` → Conocimiento del subrol (null en Opción 1)
- `{{user_avi_subrol_behavior}}` → Comportamiento del subrol (null en Opción 1)

**Archivos a Modificar**:
1. `api/server/services/Endpoints/agents/agent.js` → Extender población de datos
2. `packages/data-provider/src/types.ts` → Agregar tipos TypeScript
3. `packages/data-provider/src/parsers.ts` → Agregar patrones de reemplazo
4. `packages/data-provider/src/config.ts` → Registrar nuevas variables

**Beneficios Esperados**:
- Prompts adaptativos según nivel de conocimiento
- Recordatorios automáticos de comportamiento esperado
- Onboarding personalizado por rol
- Mejor contexto para auditoría y logs

**Ver sección completa**: [🚀 Próxima Implementación: Variables de `knowledge` y `behavior`](#🚀-próxima-implementación-variables-de-knowledge-y-behavior)

---

**¡Implementación Fase 1 Completada!** 🎉  
**Siguiente: Fase 2 - Variables de `knowledge` y `behavior`** 🚀
