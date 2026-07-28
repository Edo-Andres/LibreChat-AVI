# 🔍 Diagnóstico: Script No Aplica Cambios en MongoDB

## 🐛 Síntoma

El script `reload-avi-roles.sh` ejecuta "exitosamente" pero:
- ✅ Lee correctamente `librechat.yaml` (se ve `AviRol` en los logs)
- ❌ Luego usa configuración hardcoded (mensaje de WARNING)
- ❌ No crea el nuevo rol `AviRol` en MongoDB
- ❌ Solo aparecen los 3 roles por defecto: `generico`, `cuidador`, `administrativo`

## 🔍 Análisis de Logs

### Log Clave 1: Configuración Cargada
```
2025-10-17 03:53:35 info: Custom config file loaded:
{
  ...
  "aviRoles": {
    "roles": [
      {
        "name": "AviRol",      ← ✅ SE LEE CORRECTAMENTE
        "subroles": [
          "Subrol_1",
          "Subrol_2",
          "Subrol_3"
        ]
      },
      ...
    ]
  }
}
```

**✅ Conclusión:** `getAppConfig()` lee correctamente el archivo YAML.

### Log Clave 2: Fallback Activado
```
2025-10-17 03:53:35 warn: [AVI Roles] Usando configuración por defecto (hardcoded)
```

**❌ Problema:** Algo falla en la validación, causando que use DEFAULT_CONFIG.

## 🎯 Causa Raíz (Hipótesis)

El problema está en la función `validateAndNormalizeConfig()`:

```javascript
async function getAviRolesFromConfig() {
  try {
    const appConfig = await getAppConfig({ refresh: true });
    
    if (appConfig && appConfig.aviRoles) {
      logger.info('[AVI Roles] Configuración cargada desde librechat.yaml');
      return validateAndNormalizeConfig(appConfig.aviRoles);  // ← Error aquí
    }
  } catch (error) {
    logger.error('[AVI Roles] Error al cargar configuración:', error);
    logger.warn('[AVI Roles] Usando configuración por defecto como fallback');
    return validateAndNormalizeConfig(DEFAULT_CONFIG);  // ← Usa fallback
  }
}
```

Posibles causas:
1. `validateAndNormalizeConfig()` lanza un `throw` que es capturado por el `catch`
2. El error no se está logueando correctamente (solo muestra `error` en vez de `error.message`)
3. La estructura de `aviRoles` en YAML no cumple alguna validación

## ✅ Solución Aplicada

Modifiqué `config/avi-roles-config.js` para agregar más logs de diagnóstico:

```javascript
async function getAviRolesFromConfig() {
  try {
    const appConfig = await getAppConfig({ refresh: true });
    
    if (appConfig && appConfig.aviRoles) {
      logger.info('[AVI Roles] Configuración cargada desde librechat.yaml');
      logger.debug('[AVI Roles] Config raw:', JSON.stringify(appConfig.aviRoles, null, 2));
      
      try {
        const validated = validateAndNormalizeConfig(appConfig.aviRoles);
        logger.info('[AVI Roles] Configuración validada correctamente');
        return validated;
      } catch (validationError) {
        logger.error('[AVI Roles] Error validando configuración:', validationError.message);
        throw validationError;
      }
    }
  } catch (error) {
    logger.error('[AVI Roles] Error al cargar configuración:', error.message);
    logger.error('[AVI Roles] Stack:', error.stack);  // ← NUEVO: Stack trace completo
    logger.warn('[AVI Roles] Usando configuración por defecto como fallback');
    return validateAndNormalizeConfig(DEFAULT_CONFIG);
  }
}
```

## 🧪 Pasos para Diagnosticar

### Paso 1: Rebuild con Logs Mejorados

```powershell
# Rebuild del contenedor para incluir los logs mejorados
docker-compose -f deploy-compose.yml build api

# Reiniciar
docker-compose -f deploy-compose.yml down
docker-compose -f deploy-compose.yml up -d
```

### Paso 2: Ejecutar Script con Logs Detallados

```bash
# Desde dentro del contenedor
docker exec -it LibreChat-API sh
cd /app/scripts
sh reload-avi-roles.sh --interactive
```

**Buscar en los logs:**
```
[AVI Roles] Config raw: { ... }           ← Ver estructura exacta
[AVI Roles] Error validando configuración: ...  ← Mensaje de error específico
[AVI Roles] Stack: ...                    ← Stack trace completo
```

### Paso 3: Verificar Estructura en YAML

**Posibles problemas en `librechat.yaml`:**

#### ❌ Problema Potencial 1: Indentación Incorrecta

```yaml
# ❌ INCORRECTO (migrations con indentación incorrecta)
aviRoles:
  roles:
    - name: AviRol
      subroles: [...]
  migrations:
    roles: {}    # ← Debe tener misma indentación que "roles"
```

#### ✅ Correcto:
```yaml
aviRoles:
  roles:
    - name: AviRol
      subroles:
        - Subrol_1
  migrations:
    roles: {}
    subroles: {}
    defaultRoleForOrphans: generico
```

#### ❌ Problema Potencial 2: migrations.roles/subroles como Object

En YAML, esto:
```yaml
migrations:
  roles: {}
    # Ejemplo:
    # generico: usuario_basico
```

Puede interpretarse incorrectamente. Debe ser:

```yaml
migrations:
  roles: {}
  subroles: {}
  # Para activar mapeos, quitar {} y poner:
  # roles:
  #   generico: usuario_basico
```

### Paso 4: Verificar en MongoDB

```bash
# Conectar a MongoDB
docker exec -it chat-mongodb mongosh LibreChat

# Ver roles actuales
db.avirols.find()

# Ver subroles actuales
db.avisubrols.find()

# Contar documentos
db.avirols.countDocuments()
```

## 🔧 Comandos de Verificación

### Verificar Config Parseada

```bash
# Ver cómo se parsea la configuración
docker exec LibreChat-API node -e "
const { getAppConfig } = require('./api/server/services/Config/app');
getAppConfig({ refresh: true }).then(config => {
  console.log('aviRoles:', JSON.stringify(config.aviRoles, null, 2));
});
"
```

### Verificar Validación

```bash
# Probar validación directamente
docker exec LibreChat-API node -e "
const { getAviRolesFromConfig } = require('./config/avi-roles-config');
getAviRolesFromConfig().then(config => {
  console.log('Config validada:', JSON.stringify(config, null, 2));
}).catch(err => {
  console.error('Error:', err.message);
});
"
```

### Ver Logs en Tiempo Real

```powershell
# Ver logs del contenedor mientras ejecutas el script
docker logs -f LibreChat-API
```

En otra terminal:
```powershell
docker exec -it LibreChat-API sh -c "cd /app/scripts && sh reload-avi-roles.sh"
```

## 📊 Resultado Esperado vs Actual

### ❌ Actual (con el bug)

```
2025-10-17 03:53:35 info: [AVI Roles] Configuración cargada desde librechat.yaml
2025-10-17 03:53:35 warn: [AVI Roles] Usando configuración por defecto (hardcoded)
                                      ↑ SALTA DIRECTO A FALLBACK
```

MongoDB:
```javascript
// Solo 3 roles (hardcoded)
[ "generico", "cuidador", "administrativo" ]
```

### ✅ Esperado (después del fix)

```
2025-10-17 04:00:00 info: [AVI Roles] Configuración cargada desde librechat.yaml
2025-10-17 04:00:00 debug: [AVI Roles] Config raw: { "roles": [...], "migrations": {...} }
2025-10-17 04:00:00 info: [AVI Roles] Configuración validada correctamente
2025-10-17 04:00:00 info: [AVI Roles Migration] PASO 1: Migrando roles...
2025-10-17 04:00:00 info:    ➕ Creado: "AviRol"
```

MongoDB:
```javascript
// 4 roles
[
  { name: "generico" },
  { name: "cuidador" },
  { name: "administrativo" },
  { name: "AviRol" }  // ← NUEVO
]
```

## 🎯 Próximos Pasos

1. **Rebuild con logs mejorados:**
   ```powershell
   docker-compose -f deploy-compose.yml build api
   docker-compose -f deploy-compose.yml up -d
   ```

2. **Ejecutar script y capturar logs completos:**
   ```bash
   docker exec -it LibreChat-API sh -c "cd /app/scripts && sh reload-avi-roles.sh" 2>&1 | tee migration.log
   ```

3. **Buscar mensaje específico de error:**
   ```
   [AVI Roles] Error validando configuración: ...
   ```

4. **Reportar hallazgos** con el error exacto para fix específico

---

**Fecha:** 17 de Octubre, 2025  
**Estado:** En diagnóstico - Logs mejorados aplicados
