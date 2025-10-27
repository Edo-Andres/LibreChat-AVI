# 📋 Implementación del Campo `registerAnswer` en AVI Roles

**Fecha**: 27 de Octubre, 2025  
**Branch**: `dev_registerAnswer`  
**Objetivo**: Agregar campo `registerAnswer` a roles y subroles AVI, configurable desde `librechat.yaml` y disponible como variable especial en prompts.

---

## 🎯 Resumen Ejecutivo

### ¿Qué es `registerAnswer`?
Campo opcional que almacena una respuesta personalizada asociada a un rol o subrol AVI. Esta respuesta será seleccionada por el usuario en el formulario de registro y estará disponible como variable especial en prompts del sistema.

### Características
- **Tipo**: String opcional (puede ser `null`)
- **Límite**: 10,000 caracteres (consistente con `knowledge` y `behavior`)
- **Independencia**: Cada rol/subrol tiene su propio `registerAnswer` (sin herencia)
- **Configurable**: Desde `librechat.yaml`
- **Disponible como**: Variables especiales `{{user_avi_rol_registerAnswer}}` y `{{user_avi_subrol_registerAnswer}}`

---

## 📊 Arquitectura de la Solución

### Flujo de Datos

```
librechat.yaml
    ↓ (lectura)
scripts/reload-avi-roles.sh (ejecuta migración)
    ↓ (invoca)
config/avi-roles-config.js (lógica de migración)
    ↓ (sincronización)
MongoDB (avirols, avisubrols)
    ↓ (populate)
packages/data-schemas/methods/user.ts
    ↓ (paso a contexto)
api/server/services/Endpoints/agents/agent.js
    ↓ (reemplazo de variables)
packages/data-provider/src/parsers.ts
    ↓ (render)
Prompt final del agente
```

---

## 🔧 FASE 1: Actualización de Schemas MongoDB

### 1.1 Schema `aviRol.ts`

**Archivo**: `packages/data-schemas/src/schema/aviRol.ts`

**Cambios**:
```typescript
const aviRolSchema: Schema<IAviRol> = new Schema(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      index: true,
      trim: true,
    },
    knowledge: {
      type: String,
      required: false,
      default: null,
      maxlength: 10000,
      trim: true,
    },
    behavior: {
      type: String,
      required: false,
      default: null,
      maxlength: 10000,
      trim: true,
    },
    // ✅ NUEVO CAMPO
    registerAnswer: {
      type: String,
      required: false,
      default: null,
      maxlength: 10000,
      trim: true,
    },
  },
  {
    timestamps: true,
  },
);
```

### 1.2 Schema `aviSubrol.ts`

**Archivo**: `packages/data-schemas/src/schema/aviSubrol.ts`

**Cambios**: Mismo campo `registerAnswer` que en aviRol.

### 1.3 Tipos TypeScript

**Archivo**: `packages/data-schemas/src/types/aviRol.ts`

```typescript
export interface IAviRol extends Document {
  _id: Types.ObjectId;
  name: string;
  knowledge?: string | null;
  behavior?: string | null;
  registerAnswer?: string | null; // ✅ NUEVO
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateAviRolRequest {
  name: string;
  knowledge?: string | null;
  behavior?: string | null;
  registerAnswer?: string | null; // ✅ NUEVO
}

export interface UpdateAviRolRequest {
  name?: string;
  knowledge?: string | null;
  behavior?: string | null;
  registerAnswer?: string | null; // ✅ NUEVO
}
```

**Archivo**: `packages/data-schemas/src/types/aviSubrol.ts`  
(Cambios análogos)

---

## 📝 FASE 2: Configuración y Migración

### 2.1 Retrocompatibilidad de Subroles en YAML

**Problema**: Actualmente, subroles solo soportan array de strings:
```yaml
subroles:
  - Cuidador
  - Psicólogo
```

**Solución**: Soportar también formato de objetos:
```yaml
subroles:
  - name: Cuidador
    knowledge: "Conocimiento específico"
    behavior: "Comportamiento específico"
    registerAnswer: "Respuesta personalizada"
  - name: Psicólogo
    # Campos opcionales
```

**Implementación en `config/avi-roles-config.js`**:

> **Nota**: Este archivo contiene la lógica de migración que es ejecutada por `scripts/reload-avi-roles.sh`

```javascript
/**
 * Normaliza subroles para aceptar formato antiguo (string[]) o nuevo (objeto[])
 */
function normalizeSubroles(subroles) {
  if (!subroles || !Array.isArray(subroles)) {
    return [];
  }
  
  return subroles.map(subrol => {
    // Formato antiguo: "Cuidador" (string)
    if (typeof subrol === 'string') {
      return {
        name: subrol,
        knowledge: null,
        behavior: null,
        registerAnswer: null,
      };
    }
    
    // Formato nuevo: { name: "Cuidador", ... } (objeto)
    return {
      name: subrol.name,
      knowledge: subrol.knowledge || null,
      behavior: subrol.behavior || null,
      registerAnswer: subrol.registerAnswer || null,
    };
  });
}
```

### 2.2 Detección de Cambios en Subroles

**Función**: `analyzeChanges()`

**Agregar**:
```javascript
// ✅ NUEVO: Detectar cambios en subroles (knowledge, behavior, registerAnswer)
for (const roleConfig of config.roles) {
  const dbRole = currentRoles.find(r => r.name === roleConfig.name);
  if (dbRole && roleConfig.subroles) {
    const normalizedSubroles = normalizeSubroles(roleConfig.subroles);
    const currentRolSubroles = currentSubroles.filter(
      s => s.parentRolId.toString() === dbRole._id.toString()
    );
    
    for (const subrolConfig of normalizedSubroles) {
      const existingSubrol = currentRolSubroles.find(s => s.name === subrolConfig.name);
      
      if (existingSubrol) {
        const updates = {};
        
        // Comparar knowledge
        if ((existingSubrol.knowledge || null) !== (subrolConfig.knowledge || null)) {
          updates.knowledge = {
            from: existingSubrol.knowledge || null,
            to: subrolConfig.knowledge || null
          };
        }
        
        // Comparar behavior
        if ((existingSubrol.behavior || null) !== (subrolConfig.behavior || null)) {
          updates.behavior = {
            from: existingSubrol.behavior || null,
            to: subrolConfig.behavior || null
          };
        }
        
        // Comparar registerAnswer
        if ((existingSubrol.registerAnswer || null) !== (subrolConfig.registerAnswer || null)) {
          updates.registerAnswer = {
            from: existingSubrol.registerAnswer || null,
            to: subrolConfig.registerAnswer || null
          };
        }
        
        if (Object.keys(updates).length > 0) {
          changes.subrolesToUpdate.push({
            name: subrolConfig.name,
            parentRole: roleConfig.name,
            id: existingSubrol._id,
            updates: updates
          });
        }
      }
    }
  }
}
```

### 2.3 Migración de Roles

**Función**: `migrateRoles()`

**Actualizar**:
```javascript
// Crear roles nuevos
for (const roleConfig of config.roles) {
  const roleName = roleConfig.name;
  const exists = currentRoles.find(r => r.name === roleName);
  const isRenamed = renamedTargets.includes(roleName);
  
  if (!exists && !isRenamed) {
    const newRole = new AviRol({
      name: roleName,
      knowledge: roleConfig.knowledge || null,
      behavior: roleConfig.behavior || null,
      registerAnswer: roleConfig.registerAnswer || null, // ✅ NUEVO
    });
    await newRole.save(sessionOpt);
    logger.info(`   ➕ Creado: "${roleName}"`);
  } else if (exists) {
    // Actualizar campos si cambiaron
    const updateFields = {};
    if (roleConfig.knowledge !== undefined) {
      updateFields.knowledge = roleConfig.knowledge || null;
    }
    if (roleConfig.behavior !== undefined) {
      updateFields.behavior = roleConfig.behavior || null;
    }
    if (roleConfig.registerAnswer !== undefined) { // ✅ NUEVO
      updateFields.registerAnswer = roleConfig.registerAnswer || null;
    }
    
    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await AviRol.updateOne({ _id: exists._id }, { $set: updateFields }, sessionOpt || {});
      logger.info(`   🔄 Actualizado: "${roleName}"`);
    }
  }
}
```

### 2.4 Migración de Subroles

**Función**: `migrateSubroles()`

**Cambios críticos**:
```javascript
// Procesar subroles del rol
const normalizedSubroles = normalizeSubroles(roleData.subroles);

for (const subrolConfig of normalizedSubroles) {
  const exists = currentRolSubroles.find(s => s.name === subrolConfig.name);
  const wasRenamed = Object.values(migrations.subroles || {}).includes(subrolConfig.name);
  
  if (!exists && !wasRenamed) {
    // CREAR subrol nuevo
    const newSubrol = new AviSubrol({
      name: subrolConfig.name,
      parentRolId: roleData.id,
      knowledge: subrolConfig.knowledge || null,      // ✅ ACTUALIZADO (antes era null hardcoded)
      behavior: subrolConfig.behavior || null,        // ✅ ACTUALIZADO
      registerAnswer: subrolConfig.registerAnswer || null, // ✅ NUEVO
    });
    await newSubrol.save(sessionOpt);
    logger.info(`      ➕ Creado: "${subrolConfig.name}"`);
  } else if (exists) {
    // ACTUALIZAR subrol existente
    const updateFields = {};
    
    if ((exists.knowledge || null) !== (subrolConfig.knowledge || null)) {
      updateFields.knowledge = subrolConfig.knowledge || null;
    }
    if ((exists.behavior || null) !== (subrolConfig.behavior || null)) {
      updateFields.behavior = subrolConfig.behavior || null;
    }
    if ((exists.registerAnswer || null) !== (subrolConfig.registerAnswer || null)) { // ✅ NUEVO
      updateFields.registerAnswer = subrolConfig.registerAnswer || null;
    }
    
    if (Object.keys(updateFields).length > 0) {
      updateFields.updatedAt = new Date();
      await AviSubrol.updateOne({ _id: exists._id }, { $set: updateFields }, sessionOpt || {});
      logger.info(`      🔄 Actualizado: "${subrolConfig.name}"`);
    }
  }
}
```

### 2.5 Ejemplo en `librechat.yaml`

```yaml
aviRoles:
  roles:
    - name: Admin
      knowledge: "Conocimiento técnico avanzado"
      behavior: "Responde técnico, conciso y orientado a soluciones."
      registerAnswer: "Bienvenido al sistema como Administrador. Tienes acceso completo a todas las funcionalidades."
      subroles:
        # Formato nuevo (objeto) - con todos los campos
        - name: Programador
          knowledge: "Conocimiento específico de programación"
          behavior: "Enfocado en código y arquitectura"
          registerAnswer: "Tu rol es desarrollar y mantener el sistema."
        
        # Formato nuevo (objeto) - solo nombre (retrocompatible)
        - name: Configuración
        
        # Formato antiguo (string) - también funciona
        - Supervisor
    
    - name: Roles_AVI
      knowledge: "Conocimiento para usuarios AVI"
      behavior: "Tono: Amable, orientado a cuidado de niños."
      registerAnswer: "Gracias por unirte al equipo AVI. Tu rol es fundamental."
      subroles:
        - name: Cuidador
          registerAnswer: "Como cuidador, tu rol es brindar apoyo directo a los niños."
        - name: Psicólogo
          knowledge: "Psicología infantil y técnicas terapéuticas"
          behavior: "Empático, profesional, basado en evidencia"
          registerAnswer: "Tu experiencia en salud mental es invaluable para el equipo."
```

---

## 🔌 FASE 3: Special Variables

### 3.1 Declarar Variables Especiales

**Archivo**: `packages/data-provider/src/config.ts`

```typescript
export const specialVariables = {
  current_date: true,
  current_user: true,
  iso_datetime: true,
  current_datetime: true,
  user_avi_rol: true,
  user_avi_subrol: true,
  user_avi_rol_knowledge: true,
  user_avi_rol_behavior: true,
  user_avi_subrol_knowledge: true,
  user_avi_subrol_behavior: true,
  user_avi_rol_registerAnswer: true,        // ✅ NUEVO
  user_avi_subrol_registerAnswer: true,     // ✅ NUEVO
};
```

### 3.2 Actualizar Tipos de Usuario

**Archivo**: `packages/data-provider/src/types.ts`

```typescript
export type TUser = {
  // ... campos existentes
  aviRol?: string;
  aviSubrol?: string;
  aviRolKnowledge?: string | null;
  aviRolBehavior?: string | null;
  aviSubrolKnowledge?: string | null;
  aviSubrolBehavior?: string | null;
  aviRolRegisterAnswer?: string | null;      // ✅ NUEVO
  aviSubrolRegisterAnswer?: string | null;   // ✅ NUEVO
};
```

### 3.3 Popular Campo en Query MongoDB

**Archivo**: `packages/data-schemas/src/methods/user.ts`

```typescript
async function getUserWithAviRoles(userId: string): Promise<IUser | null> {
  const User = mongoose.models.User;
  return await User.findById(userId)
    .populate('aviRol_id', 'name knowledge behavior registerAnswer')      // ✅ AGREGADO registerAnswer
    .populate('aviSubrol_id', 'name knowledge behavior registerAnswer')   // ✅ AGREGADO registerAnswer
    .lean() as IUser | null;
}
```

### 3.4 Implementar Reemplazo de Variables

**Archivo**: `packages/data-provider/src/parsers.ts`

```typescript
export function replaceSpecialVars({ text, user }: { text: string; user?: t.TUser }): string {
  // ... código existente ...
  
  // Replace AVI role registerAnswer variables
  if (user && user.aviRolRegisterAnswer) {
    result = result.replace(/{{user_avi_rol_registerAnswer}}/gi, user.aviRolRegisterAnswer);
  } else {
    result = result.replace(/{{user_avi_rol_registerAnswer}}/gi, '');
  }

  // Replace AVI subrol registerAnswer variables
  if (user && user.aviSubrolRegisterAnswer) {
    result = result.replace(/{{user_avi_subrol_registerAnswer}}/gi, user.aviSubrolRegisterAnswer);
  } else {
    result = result.replace(/{{user_avi_subrol_registerAnswer}}/gi, '');
  }

  return result;
}
```

### 3.5 Pasar Variables en Agentes

**Archivo**: `api/server/services/Endpoints/agents/agent.js`

```javascript
if (req.user && (req.user.aviRol_id || req.user.aviSubrol_id)) {
  try {
    const populatedUser = await getUserWithAviRoles(req.user.id || req.user._id);
    if (populatedUser) {
      userWithRoles = {
        ...req.user,
        aviRol: populatedUser.aviRol_id?.name || '',
        aviSubrol: populatedUser.aviSubrol_id?.name || '',
        aviRolKnowledge: populatedUser.aviRol_id?.knowledge || null,
        aviRolBehavior: populatedUser.aviRol_id?.behavior || null,
        aviSubrolKnowledge: populatedUser.aviSubrol_id?.knowledge || null,
        aviSubrolBehavior: populatedUser.aviSubrol_id?.behavior || null,
        aviRolRegisterAnswer: populatedUser.aviRol_id?.registerAnswer || null,        // ✅ NUEVO
        aviSubrolRegisterAnswer: populatedUser.aviSubrol_id?.registerAnswer || null,  // ✅ NUEVO
      };
    }
  } catch (error) {
    console.error('[agent.js] Error populating AVI roles:', error);
  }
}
```

---

## 🧪 Plan de Pruebas

### Prerequisito: Ejecutar Migración

Todos los cambios en `librechat.yaml` requieren ejecutar el script de migración:

```bash
# En PowerShell (Windows)
.\scripts\reload-avi-roles.sh

# O si prefieres modo interactivo con confirmación
.\scripts\reload-avi-roles.sh --interactive
```

> **Nota**: El script `reload-avi-roles.sh` lee `librechat.yaml`, ejecuta la lógica de migración en `config/avi-roles-config.js`, y sincroniza los cambios a MongoDB.

### Prueba 1: Migración con Formato Antiguo (Retrocompatibilidad)

**librechat.yaml**:
```yaml
aviRoles:
  roles:
    - name: TestRole
      registerAnswer: "Respuesta del rol"
      subroles:
        - SubrolAntiguo  # Formato string
```

**Verificar en MongoDB**:
```javascript
db.avisubrols.findOne({ name: "SubrolAntiguo" })
// Debe tener: knowledge: null, behavior: null, registerAnswer: null
```

### Prueba 2: Migración con Formato Nuevo

**librechat.yaml**:
```yaml
aviRoles:
  roles:
    - name: TestRole
      registerAnswer: "Respuesta del rol"
      subroles:
        - name: SubrolNuevo
          knowledge: "Conocimiento test"
          behavior: "Comportamiento test"
          registerAnswer: "Respuesta del subrol"
```

**Ejecutar**:
```bash
.\scripts\reload-avi-roles.sh
```

**Verificar en MongoDB**:
```javascript
db.avisubrols.findOne({ name: "SubrolNuevo" })
// Debe tener todos los campos con valores correctos
```

### Prueba 3: Actualización de Campos Existentes

1. Ejecutar migración inicial: `.\scripts\reload-avi-roles.sh`
2. Cambiar `registerAnswer` en `librechat.yaml`
3. Ejecutar migración nuevamente: `.\scripts\reload-avi-roles.sh`
4. Verificar que MongoDB refleje los cambios

### Prueba 4: Variables Especiales en Prompts

**Prompt de prueba**:
```
Hola {{current_user}}, tu rol es {{user_avi_rol}} con subrol {{user_avi_subrol}}.

Mensaje de bienvenida:
{{user_avi_rol_registerAnswer}}

Mensaje específico de tu subrol:
{{user_avi_subrol_registerAnswer}}
```

**Resultado esperado**:
```
Hola JohnDoe, tu rol es Admin con subrol Programador.

Mensaje de bienvenida:
Bienvenido al sistema como Administrador. Tienes acceso completo.

Mensaje específico de tu subrol:
Tu rol es desarrollar y mantener el sistema.
```

---

## 📦 Checklist de Implementación

### Fase 1: Schemas MongoDB
- [ ] Actualizar `packages/data-schemas/src/schema/aviRol.ts`
- [ ] Actualizar `packages/data-schemas/src/schema/aviSubrol.ts`
- [ ] Actualizar `packages/data-schemas/src/types/aviRol.ts`
- [ ] Actualizar `packages/data-schemas/src/types/aviSubrol.ts`
- [ ] Recompilar: `cd packages/data-schemas && npm run build`

### Fase 2: Configuración y Migración
- [ ] Crear función `normalizeSubroles()` en `config/avi-roles-config.js`
- [ ] Actualizar `validateAndNormalizeConfig()`
- [ ] Actualizar `analyzeChanges()` - agregar `subrolesToUpdate`
- [ ] Actualizar `mostrarResumenYConfirmar()` - mostrar cambios en subroles
- [ ] Actualizar `migrateRoles()` - incluir `registerAnswer`
- [ ] Actualizar `migrateSubroles()` - incluir todos los campos
- [ ] Actualizar `librechat.yaml` con ejemplos

### Fase 3: Special Variables
- [ ] Actualizar `packages/data-provider/src/config.ts`
- [ ] Actualizar `packages/data-provider/src/types.ts`
- [ ] Actualizar `packages/data-schemas/src/methods/user.ts`
- [ ] Recompilar data-schemas: `cd packages/data-schemas && npm run build`
- [ ] Actualizar `packages/data-provider/src/parsers.ts`
- [ ] Recompilar data-provider: `cd packages/data-provider && npm run build`
- [ ] Actualizar `api/server/services/Endpoints/agents/agent.js`

### Pruebas
- [ ] Ejecutar `.\scripts\reload-avi-roles.sh`
- [ ] Verificar MongoDB (roles y subroles actualizados)
- [ ] Probar formato antiguo de subroles (string[])
- [ ] Probar formato nuevo de subroles (objeto[])
- [ ] Probar variables en prompts de agentes
- [ ] Validar que cambios se detecten correctamente

### Documentación
- [ ] Actualizar `GUIA_AGREGAR_CAMPOS_AVI_ROLES.md`
- [ ] Documentar nuevas variables especiales
- [ ] Documentar formato de subroles en YAML
- [ ] Ejemplos prácticos de uso

---

## 🚨 Consideraciones Importantes

### Ejecución de Migración

- ⚠️ **Siempre ejecutar**: `.\scripts\reload-avi-roles.sh` después de modificar `librechat.yaml`
- ✅ **Modo interactivo**: Usa `.\scripts\reload-avi-roles.sh --interactive` para ver un resumen antes de aplicar cambios
- 🔄 **Hot reload**: Si el backend está corriendo con nodemon, detectará cambios en `librechat.yaml` y reiniciará automáticamente
- 📝 **Logs**: El script muestra un resumen detallado de todos los cambios aplicados

### Validaciones
- **Límite de caracteres**: 10,000 (igual que knowledge/behavior)
- **Trim automático**: Los espacios en blanco se eliminan
- **Strings vacíos**: Se convierten a `null`
- **Campo opcional**: No es obligatorio definirlo

### Retrocompatibilidad
- ✅ Formato antiguo de subroles (`string[]`) sigue funcionando
- ✅ Migraciones no afectan datos existentes
- ✅ Campos no definidos se guardan como `null`

### Performance
- Las queries con `.populate()` traen solo los campos necesarios
- Índices existentes no se afectan
- No requiere migración de datos históricos

### Seguridad
- Los valores se sanitizan automáticamente (trim)
- Límite de 10,000 caracteres previene ataques
- Variables vacías se reemplazan por string vacío (no rompen prompts)

---

## 📚 Referencias

- **Commit de referencia**: `99c9c4370585fe1760d12e532a731ab0eae9a313`
  - Implementación de `knowledge` y `behavior` como special variables
- **Guía existente**: `GUIA_AGREGAR_CAMPOS_AVI_ROLES.md`
- **Branch**: `dev_registerAnswer`

---

## 🎉 Resultado Final

Después de esta implementación:

1. ✅ `registerAnswer` estará disponible en roles y subroles
2. ✅ Se podrá configurar desde `librechat.yaml`
3. ✅ Se sincronizará automáticamente a MongoDB
4. ✅ Estará disponible como variable especial en prompts
5. ✅ Soportará formato antiguo y nuevo de subroles
6. ✅ Mantendrá consistencia con `knowledge` y `behavior`

**Variables disponibles en prompts**:
- `{{user_avi_rol_registerAnswer}}`
- `{{user_avi_subrol_registerAnswer}}`
