# 🎯 Resumen de Implementación: Variables AVI Roles en Prompts

**Fecha**: 2025-10-04  
**Branch**: `feat_variables_promt`  
**Autor**: Implementación de variables `{{user_avi_rol}}` y `{{user_avi_subrol}}`

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

// Nuevas (específicas por campo)
{{user_avi_rol_name}}  → aviRol.name
{{user_avi_rol_conocimiento}} → aviRol.conocimiento
{{user_avi_subrol_descripcion}} → aviSubrol.descripcion
```

### Cambios Necesarios
1. Agregar campos al tipo `TUser` en `types.ts`
2. Extender lógica de populate en `agent.js` para extraer más campos
3. Agregar patrones de reemplazo en `replaceSpecialVars` en `parsers.ts`
4. Agregar a `specialVariables` en `config.ts`

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

### Lo que se implementó:
✅ 2 nuevas variables especiales: `{{user_avi_rol}}` y `{{user_avi_subrol}}`  
✅ Sistema de populate automático en `agent.js`  
✅ Reemplazo con nombres de roles (no IDs ni objetos)  
✅ Strings vacíos cuando no hay roles  
✅ Documentación completa  
✅ Script de prueba funcional  
✅ Sistema extensible para futuros campos  

### Listo para:
🚀 Compilación en Docker  
🚀 Despliegue en producción  
🚀 Testing con usuarios reales  
🚀 Extensiones futuras  

---

**¡Implementación Completada!** 🎉
