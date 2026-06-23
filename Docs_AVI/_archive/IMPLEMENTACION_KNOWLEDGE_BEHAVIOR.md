# 🚀 Implementación: Variables de Knowledge y Behavior

**Fecha**: 2025-10-22  
**Branch**: `dev_add_knowledge_behavior`  
**Autor**: Implementación de variables de conocimiento y comportamiento para roles AVI

---

## ✅ Resumen Ejecutivo

Se han implementado **4 nuevas variables especiales** para exponer los campos `knowledge` y `behavior` de los roles AVI en los prompts de los agentes:

### Nuevas Variables

```typescript
{{user_avi_rol_knowledge}}    // Conocimiento esperado del rol
{{user_avi_rol_behavior}}     // Comportamiento esperado del rol
{{user_avi_subrol_knowledge}} // Conocimiento del subrol (null en Opción 1)
{{user_avi_subrol_behavior}}  // Comportamiento del subrol (null en Opción 1)
```

---

## 📋 Archivos Modificados

### 1. **Backend**

#### `packages/data-provider/src/config.ts`
**Cambio**: Agregadas 4 nuevas variables al objeto `specialVariables`
```typescript
export const specialVariables = {
  current_date: true,
  current_user: true,
  iso_datetime: true,
  current_datetime: true,
  user_avi_rol: true,
  user_avi_subrol: true,
  user_avi_rol_knowledge: true,      // ✅ NUEVO
  user_avi_rol_behavior: true,       // ✅ NUEVO
  user_avi_subrol_knowledge: true,   // ✅ NUEVO
  user_avi_subrol_behavior: true,    // ✅ NUEVO
};
```

#### `packages/data-provider/src/types.ts`
**Cambio**: Agregados 4 campos opcionales al tipo `TUser`
```typescript
export type TUser = {
  // ... campos existentes ...
  aviRol?: string;
  aviSubrol?: string;
  aviRolKnowledge?: string | null;      // ✅ NUEVO
  aviRolBehavior?: string | null;       // ✅ NUEVO
  aviSubrolKnowledge?: string | null;   // ✅ NUEVO
  aviSubrolBehavior?: string | null;    // ✅ NUEVO
};
```

#### `packages/data-provider/src/parsers.ts`
**Cambio**: Agregados 4 nuevos bloques de reemplazo en `replaceSpecialVars()`
```typescript
// Replace AVI role knowledge variables
if (user && user.aviRolKnowledge) {
  result = result.replace(/{{user_avi_rol_knowledge}}/gi, user.aviRolKnowledge);
} else {
  result = result.replace(/{{user_avi_rol_knowledge}}/gi, '');
}

// Replace AVI role behavior variables
if (user && user.aviRolBehavior) {
  result = result.replace(/{{user_avi_rol_behavior}}/gi, user.aviRolBehavior);
} else {
  result = result.replace(/{{user_avi_rol_behavior}}/gi, '');
}

// Replace AVI subrol knowledge variables
if (user && user.aviSubrolKnowledge) {
  result = result.replace(/{{user_avi_subrol_knowledge}}/gi, user.aviSubrolKnowledge);
} else {
  result = result.replace(/{{user_avi_subrol_knowledge}}/gi, '');
}

// Replace AVI subrol behavior variables
if (user && user.aviSubrolBehavior) {
  result = result.replace(/{{user_avi_subrol_behavior}}/gi, user.aviSubrolBehavior);
} else {
  result = result.replace(/{{user_avi_subrol_behavior}}/gi, '');
}
```

#### `api/server/services/Endpoints/agents/agent.js`
**Cambio**: Extendida la población de roles para incluir `knowledge` y `behavior`
```javascript
if (populatedUser) {
  userWithRoles = {
    ...req.user,
    aviRol: populatedUser.aviRol_id?.name || '',
    aviSubrol: populatedUser.aviSubrol_id?.name || '',
    aviRolKnowledge: populatedUser.aviRol_id?.knowledge || null,      // ✅ NUEVO
    aviRolBehavior: populatedUser.aviRol_id?.behavior || null,        // ✅ NUEVO
    aviSubrolKnowledge: populatedUser.aviSubrol_id?.knowledge || null, // ✅ NUEVO
    aviSubrolBehavior: populatedUser.aviSubrol_id?.behavior || null,   // ✅ NUEVO
  };
}
```

### 2. **Frontend (Traducciones)**

#### `client/src/locales/en/translation.json`
**Cambio**: Agregadas traducciones en inglés
```json
"com_ui_special_var_user_avi_rol": "User AVI Role",
"com_ui_special_var_user_avi_subrol": "User AVI Subrole",
"com_ui_special_var_user_avi_rol_knowledge": "User AVI Role Knowledge",
"com_ui_special_var_user_avi_rol_behavior": "User AVI Role Behavior",
"com_ui_special_var_user_avi_subrol_knowledge": "User AVI Subrole Knowledge",
"com_ui_special_var_user_avi_subrol_behavior": "User AVI Subrole Behavior"
```

#### `client/src/locales/es/translation.json`
**Cambio**: Agregadas traducciones en español
```json
"com_ui_special_var_current_date": "Fecha Actual",
"com_ui_special_var_current_datetime": "Fecha y Hora Actual",
"com_ui_special_var_current_user": "Usuario Actual",
"com_ui_special_var_iso_datetime": "Fecha/Hora UTC ISO",
"com_ui_special_var_user_avi_rol": "Rol AVI del Usuario",
"com_ui_special_var_user_avi_subrol": "Subrol AVI del Usuario",
"com_ui_special_var_user_avi_rol_knowledge": "Conocimiento del Rol AVI",
"com_ui_special_var_user_avi_rol_behavior": "Comportamiento del Rol AVI",
"com_ui_special_var_user_avi_subrol_knowledge": "Conocimiento del Subrol AVI",
"com_ui_special_var_user_avi_subrol_behavior": "Comportamiento del Subrol AVI"
```

### 3. **Testing**

#### `config/test-knowledge-behavior-variables.js` ✅ NUEVO
Script de prueba completo que valida:
- ✅ Usuario con rol administrativo (con knowledge y behavior)
- ✅ Usuario con rol cuidador (con knowledge y behavior)
- ✅ Usuario sin roles (todas las variables vacías)
- ✅ Reemplazo correcto de todas las variables
- ✅ Comportamiento de subroles (knowledge/behavior null)

---

## 🎯 Flujo Técnico Completo

```
1. Usuario hace request a endpoint de agentes
   ↓
2. Middleware JWT autentica → req.user
   ↓
3. En agent.js, se detecta si hay instrucciones
   ↓
4. Si req.user tiene aviRol_id o aviSubrol_id:
   ├── getUserWithAviRoles(userId) → Populate completo
   ├── Se extraen campos:
   │   ├── aviRol_id.name → aviRol
   │   ├── aviSubrol_id.name → aviSubrol
   │   ├── aviRol_id.knowledge → aviRolKnowledge ✅ NUEVO
   │   ├── aviRol_id.behavior → aviRolBehavior ✅ NUEVO
   │   ├── aviSubrol_id.knowledge → aviSubrolKnowledge ✅ NUEVO
   │   └── aviSubrol_id.behavior → aviSubrolBehavior ✅ NUEVO
   └── Se crea userWithRoles con todos los campos
   ↓
5. replaceSpecialVars({ text, user: userWithRoles })
   ↓
6. Se buscan y reemplazan:
   ├── {{user_avi_rol}} → aviRol (name)
   ├── {{user_avi_subrol}} → aviSubrol (name)
   ├── {{user_avi_rol_knowledge}} → aviRolKnowledge ✅ NUEVO
   ├── {{user_avi_rol_behavior}} → aviRolBehavior ✅ NUEVO
   ├── {{user_avi_subrol_knowledge}} → aviSubrolKnowledge ✅ NUEVO
   └── {{user_avi_subrol_behavior}} → aviSubrolBehavior ✅ NUEVO
   ↓
7. Retorna texto con todas las variables reemplazadas
```

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Prompt Adaptativo por Conocimiento

**Entrada (Instrucciones del Agente)**:
```
Hola {{current_user}},

Tu rol es {{user_avi_rol}} con el siguiente conocimiento esperado:
{{user_avi_rol_knowledge}}

Como agente, adaptaré mi vocabulario y profundidad técnica según tu nivel de conocimiento.

Tu comportamiento esperado es:
{{user_avi_rol_behavior}}
```

**Usuario**: Admin (administrativo)

**Salida**:
```
Hola Juan Pérez,

Tu rol es administrativo con el siguiente conocimiento esperado:
Conocimiento técnico avanzado en sistemas, bases de datos, gestión de plataformas y herramientas administrativas

Como agente, adaptaré mi vocabulario y profundidad técnica según tu nivel de conocimiento.

Tu comportamiento esperado es:
Ético, responsable, transparente en la toma de decisiones, comprometido con la mejora continua
```

### Ejemplo 2: Recordatorio de Comportamiento

**Entrada**:
```
Como {{user_avi_rol}} ({{user_avi_subrol}}), recuerda mantener el siguiente estándar:

{{user_avi_rol_behavior}}
```

**Usuario**: Cuidador (Cuidador Principal)

**Salida**:
```
Como cuidador (Cuidador Principal), recuerda mantener el siguiente estándar:

Responsable, atento, proactivo en la protección y cuidado de niños, empático, comunicativo
```

### Ejemplo 3: Usuario Sin Roles

**Entrada**:
```
Rol: {{user_avi_rol}}
Conocimiento: {{user_avi_rol_knowledge}}
Comportamiento: {{user_avi_rol_behavior}}
```

**Usuario**: Sin roles AVI asignados

**Salida**:
```
Rol: 
Conocimiento: 
Comportamiento: 
```
*(Todas las variables se reemplazan con strings vacíos)*

---

## 🧪 Testing

### Ejecutar Tests
```bash
# Asegúrate de estar en la raíz del proyecto
node config/test-knowledge-behavior-variables.js
```

### Tests Incluidos
1. ✅ Usuario con rol administrativo → Valida knowledge y behavior poblados
2. ✅ Usuario con rol cuidador → Valida knowledge y behavior poblados
3. ✅ Usuario sin roles → Valida que todas las variables sean strings vacíos
4. ✅ Subroles → Valida que knowledge y behavior sean null (Opción 1)

### Resultado Esperado
```
🎉 All tests completed successfully!

📊 Summary:
  ✅ Variables replaced correctly for users with roles
  ✅ Knowledge and behavior fields correctly populated
  ✅ Empty strings returned for users without roles
  ✅ Subroles correctly show null for knowledge/behavior

✨ The new variables are ready to use in agent prompts!
```

---

## 🚀 Despliegue

### Desarrollo Local
```bash
# 1. Instalar dependencias (si es necesario)
npm install

# 2. Compilar packages/data-provider
cd packages/data-provider
npm run build
cd ../..

# 3. Reiniciar servidor backend
npm run backend
```

### Docker (Producción)
```bash
# 1. Reconstruir imagen API
docker-compose -f deploy-compose.yml build api

# 2. Reiniciar contenedor
docker-compose -f deploy-compose.yml up -d api

# 3. Ver logs para verificar
docker-compose -f deploy-compose.yml logs -f api
```

### Verificar Compilación
Los cambios en `packages/data-provider` se compilan automáticamente en la etapa `data-provider-build` del `Dockerfile.multi`.

---

## ⚠️ Consideraciones Técnicas

### Rendimiento
- ✅ **Sin impacto adicional**: El populate ya trae los objetos completos, solo extraemos más campos
- ✅ **Caching**: No cambia la estrategia de caching actual
- ✅ **Lazy loading**: Solo se puebla si el usuario tiene `aviRol_id` o `aviSubrol_id`

### Seguridad
- ✅ **Datos no sensibles**: `knowledge` y `behavior` son descriptores generales
- ✅ **Control de acceso**: Los roles ya están validados por el sistema ACL
- ⚠️ **Longitud de campos**: Máximo 10,000 caracteres (definido en schema)

### Compatibilidad
- ✅ **Retrocompatible**: Variables anteriores (`user_avi_rol`, `user_avi_subrol`) siguen funcionando
- ✅ **Fallback a vacío**: Si el campo es `null`, se reemplaza con `""`
- ✅ **Opción 1 respetada**: Subroles siempre retornan `null` para `knowledge` y `behavior`
- ✅ **Case-insensitive**: Funciona con `{{USER_AVI_ROL_KNOWLEDGE}}`, etc.

### Base de Datos
- ✅ **Schema existente**: Los campos `knowledge` y `behavior` ya existen en `aviRol`
- ✅ **Validación**: Máximo 10,000 caracteres, tipo String, nullable
- ✅ **Populate**: Usa el método existente `getUserWithAviRoles()`

---

## 📊 Comparación: Antes vs. Después

### Antes (Fase 1)
```typescript
// Variables disponibles
{{user_avi_rol}}        → "administrativo"
{{user_avi_subrol}}     → "Gestor de Usuarios"
```

### Después (Fase 2) ✅
```typescript
// Variables de nombre (existentes)
{{user_avi_rol}}        → "administrativo"
{{user_avi_subrol}}     → "Gestor de Usuarios"

// Variables de conocimiento (NUEVAS)
{{user_avi_rol_knowledge}}    → "Conocimiento técnico avanzado..."
{{user_avi_subrol_knowledge}} → "" (null en Opción 1)

// Variables de comportamiento (NUEVAS)
{{user_avi_rol_behavior}}     → "Ético, responsable, transparente..."
{{user_avi_subrol_behavior}}  → "" (null en Opción 1)
```

---

## 🎯 Casos de Uso Reales

### 1. Onboarding Dinámico
```
Bienvenido {{current_user}},

Como {{user_avi_rol}}, se espera que tengas:
{{user_avi_rol_knowledge}}

Recuerda mantener estos valores:
{{user_avi_rol_behavior}}
```

### 2. Auditoría y Logs
```
Usuario: {{current_user}}
Rol: {{user_avi_rol}} ({{user_avi_subrol}})
Conocimientos: {{user_avi_rol_knowledge}}
Comportamiento esperado: {{user_avi_rol_behavior}}
Fecha: {{current_datetime}}
```

### 3. Adaptación de Lenguaje
```
Dado tu nivel de conocimiento:
{{user_avi_rol_knowledge}}

Usaré un lenguaje técnico avanzado / básico / intermedio.
```

### 4. Recordatorios de Comportamiento
```
Recordatorio para {{user_avi_rol}}:
{{user_avi_rol_behavior}}

¿Cumples con este estándar?
```

---

## 🔮 Próximas Extensiones (Futuro)

### Fase 3 (Potencial)
```typescript
// Variables de permisos
{{user_avi_rol_permissions}}     → Lista de permisos del rol
{{user_avi_subrol_permissions}}  → Lista de permisos del subrol

// Variables de fechas
{{user_avi_rol_assigned_date}}   → Fecha de asignación del rol
{{user_avi_subrol_assigned_date}} → Fecha de asignación del subrol

// Variables de metadata
{{user_avi_rol_description}}     → Descripción completa del rol
{{user_avi_subrol_description}}  → Descripción completa del subrol
```

---

## 📚 Referencias

- **Documentación AVI Roles**: `Docs_AVI/AVI_ROLES_DOCUMENTATION.md`
- **Implementación Fase 1**: `Docs_AVI/IMPLEMENTACION_VARIABLES_AVI.md`
- **Schema AVI Rol**: `packages/data-schemas/src/schema/aviRol.ts`
- **Schema AVI Subrol**: `packages/data-schemas/src/schema/aviSubrol.ts`
- **Métodos User**: `packages/data-schemas/src/methods/user.ts`

---

## ✨ Resumen Final

### ✅ Fase 2 Completada

**Archivos Modificados**: 6
- `packages/data-provider/src/config.ts` ✅
- `packages/data-provider/src/types.ts` ✅
- `packages/data-provider/src/parsers.ts` ✅
- `api/server/services/Endpoints/agents/agent.js` ✅
- `client/src/locales/en/translation.json` ✅
- `client/src/locales/es/translation.json` ✅

**Archivos Nuevos**: 1
- `config/test-knowledge-behavior-variables.js` ✅

**Variables Nuevas**: 4
- `{{user_avi_rol_knowledge}}` ✅
- `{{user_avi_rol_behavior}}` ✅
- `{{user_avi_subrol_knowledge}}` ✅
- `{{user_avi_subrol_behavior}}` ✅

**Traducciones**: 2 idiomas
- Inglés (EN) ✅
- Español (ES) ✅

### 🎯 Beneficios Implementados

1. ✅ **Prompts más contextuales**: Los agentes pueden adaptar su lenguaje según el conocimiento esperado
2. ✅ **Guías de comportamiento**: Recordatorios automáticos del comportamiento esperado
3. ✅ **Onboarding dinámico**: Instrucciones personalizadas por nivel de conocimiento
4. ✅ **Auditoría mejorada**: Logs con contexto completo de roles, conocimientos y comportamientos
5. ✅ **Extensibilidad**: Base sólida para futuras variables de roles AVI

### 🚀 Listo Para

- ✅ Testing con usuarios reales
- ✅ Compilación en Docker
- ✅ Despliegue en producción
- ✅ Documentación completa
- ✅ Integración con agentes existentes

---

**¡Implementación Fase 2 Completada Exitosamente!** 🎉  
**Próximo: Testing en entorno de desarrollo y despliegue** 🚀

---

**Fecha de Finalización**: 2025-10-22  
**Estado**: ✅ COMPLETADO  
**Versión**: 2.0.0 (Fase 2)
