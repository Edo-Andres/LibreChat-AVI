# 🎯 Variables AVI Roles - Documentación

## Descripción
Este documento describe las nuevas variables especiales para usar roles AVI en los prompts de agentes en LibreChat.

## Variables Disponibles

### `{{user_avi_rol}}`
Retorna el **nombre** del rol AVI asignado al usuario actual.

**Valores posibles:**
- `generico`
- `cuidador`
- `administrativo`
- `` (string vacío si el usuario no tiene rol asignado)

### `{{user_avi_subrol}}`
Retorna el **nombre** del subrol AVI asignado al usuario actual.

**Valores posibles para rol "generico":**
- `Lector`
- `Comentarista`
- `Colaborador`

**Valores posibles para rol "cuidador":**
- `Cuidador Principal`
- `Cuidador Secundario`
- `Asistente`

**Valores posibles para rol "administrativo":**
- `Gestor de Usuarios`
- `Configuración`
- `Supervisor`

**Valor por defecto:**
- `` (string vacío si el usuario no tiene subrol asignado)

---

## 📝 Ejemplos de Uso

### Ejemplo 1: Personalizar saludo según rol
```
Hola {{current_user}}, bienvenido a LibreChat.

Tu rol es: {{user_avi_rol}}
Tu subrol es: {{user_avi_subrol}}

Por favor, actúa según los permisos de tu rol.
```

**Resultado para usuario "Juan Pérez" con rol "administrativo" y subrol "Gestor de Usuarios":**
```
Hola Juan Pérez, bienvenido a LibreChat.

Tu rol es: administrativo
Tu subrol es: Gestor de Usuarios

Por favor, actúa según los permisos de tu rol.
```

---

### Ejemplo 2: Instrucciones condicionales según rol
```
Eres un asistente de LibreChat especializado en el rol {{user_avi_rol}}.

Como {{user_avi_subrol}}, tus responsabilidades incluyen:
- Si eres "Lector": Solo consultar información
- Si eres "Gestor de Usuarios": Administrar usuarios y permisos
- Si eres "Cuidador Principal": Gestionar el cuidado principal del paciente

Ayuda al usuario {{current_user}} con sus tareas según su nivel de acceso.
Fecha: {{current_date}}
```

**Resultado para usuario "María López" con rol "cuidador" y subrol "Cuidador Principal":**
```
Eres un asistente de LibreChat especializado en el rol cuidador.

Como Cuidador Principal, tus responsabilidades incluyen:
- Si eres "Lector": Solo consultar información
- Si eres "Gestor de Usuarios": Administrar usuarios y permisos
- Si eres "Cuidador Principal": Gestionar el cuidado principal del paciente

Ayuda al usuario María López con sus tareas según su nivel de acceso.
Fecha: 2025-10-04 (6)
```

---

### Ejemplo 3: Restricciones basadas en subrol
```
Sistema de Asistencia Médica AVI

Usuario: {{current_user}}
Rol: {{user_avi_rol}}
Subrol: {{user_avi_subrol}}
Fecha y hora: {{current_datetime}}

IMPORTANTE: Tus respuestas deben ajustarse al nivel de acceso de tu subrol.
```

---

## 🔧 Implementación Técnica

### Archivos Modificados

1. **`packages/data-provider/src/config.ts`**
   - Agregadas las variables `user_avi_rol` y `user_avi_subrol` al objeto `specialVariables`

2. **`packages/data-provider/src/parsers.ts`**
   - Extendida la función `replaceSpecialVars` para reemplazar las nuevas variables

3. **`packages/data-provider/src/types.ts`**
   - Agregados campos `aviRol?: string` y `aviSubrol?: string` al tipo `TUser`

4. **`api/server/services/Endpoints/agents/agent.js`**
   - Implementado populate de roles AVI usando `getUserWithAviRoles`
   - Las variables se reemplazan con el campo `name` de las colecciones

### Flujo de Datos

1. Usuario autenticado tiene `aviRol_id` y `aviSubrol_id` (ObjectIds)
2. Cuando se procesa un agente con instrucciones:
   - Se hace `populate` de los roles usando `getUserWithAviRoles(userId)`
   - Se extraen los campos `name` de los objetos poblados
   - Se crea objeto `userWithRoles` con los campos:
     - `aviRol: string` (nombre del rol)
     - `aviSubrol: string` (nombre del subrol)
3. La función `replaceSpecialVars` reemplaza las variables en el texto
4. Si no hay rol/subrol asignado, se reemplaza con string vacío `""`

---

## ⚠️ Notas Importantes

### Valores Vacíos
Si un usuario no tiene asignado un rol o subrol, las variables se reemplazan con un **string vacío** (`""`), no con textos como "sin rol" o "N/A". Esto permite mayor flexibilidad en los prompts.

### Extensibilidad Futura
El sistema está diseñado para ser extensible. En el futuro, si las colecciones `aviRol` o `aviSubrol` tienen más campos (por ejemplo, `conocimiento`), se pueden agregar nuevas variables siguiendo el patrón:

```typescript
// Futuro
{{user_avi_rol_name}}          → aviRol.name
{{user_avi_rol_conocimiento}}  → aviRol.conocimiento
{{user_avi_subrol_name}}        → aviSubrol.name
{{user_avi_subrol_conocimiento}} → aviSubrol.conocimiento
```

Y mantener retrocompatibilidad con las variables actuales como alias del campo `name`.

---

## 🚀 Despliegue

Los cambios se han implementado en los siguientes archivos que se compilan en el Dockerfile:

- `packages/data-provider` → Compilado en etapa `data-provider-build`
- `api/server/services` → Copiado al contenedor final

Para desplegar los cambios:

```bash
# Reconstruir la imagen Docker
docker-compose -f deploy-compose.yml build api

# Reiniciar el servicio
docker-compose -f deploy-compose.yml up -d api
```

---

## ✅ Testing

Para probar las variables:

1. Asignar un rol y subrol AVI a un usuario (usando scripts de migración o API)
2. Crear un agente con instrucciones que incluyan `{{user_avi_rol}}` y `{{user_avi_subrol}}`
3. Iniciar una conversación con el agente
4. Verificar que las variables se reemplacen correctamente en las instrucciones del agente

---

## 📚 Referencias

- **Sistema AVI Roles**: Ver `DOCUMENTACION_AVI_ROLES.md` y `AVI_ROLES_DOCUMENTATION.md`
- **Variables del Sistema**: Ver documentación original de variables especiales
- **Colecciones**: `aviRol` y `aviSubrol` en MongoDB

---

**Fecha de implementación**: 2025-10-04  
**Branch**: `feat_variables_promt`  
**Versión**: 1.0.0
