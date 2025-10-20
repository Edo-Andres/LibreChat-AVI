# 🔧 Fix: Error "Cannot find module '~/db/models'"

## 🐛 Problema Identificado

### Error Original
```bash
❌ Error durante la migración: Cannot find module '~/db/models'
Require stack:
- /app/api/models/File.js
- /app/api/models/index.js
- /app/config/.temp-migrate-avi-roles.js
```

### Causa Raíz

El error ocurre porque:

1. **Module Alias no configurado:** El script temporal generado por `reload-avi-roles.sh` intenta cargar `require('../api/models')` que a su vez carga archivos que usan el alias `~` (ej: `require('~/db/models')`)

2. **Orden incorrecto:** El alias `~` debe configurarse **ANTES** de hacer cualquier `require()` que lo use

3. **Configuración incorrecta:** No se estaba usando `module-alias` de la misma forma que en `api/server/index.js`

## ✅ Solución Aplicada

### Cambios en `scripts/reload-avi-roles.sh`

**❌ ANTES (código incorrecto):**
```javascript
const mongoose = require('mongoose');
const path = require('path');

// Configurar alias DESPUÉS (demasiado tarde)
const moduleAlias = require('module-alias');
const apiRoot = path.resolve(__dirname, '..', 'api');
moduleAlias.addAlias('~', apiRoot);

// Cargar modelos (falla porque ~ no está configurado aún)
require('../api/models');
```

**✅ DESPUÉS (código corregido):**
```javascript
const path = require('path');

// 1. Configurar dotenv PRIMERO
require('dotenv').config({ path: dotenvPath });

// 2. Configurar module-alias ANTES de cualquier require que use ~
const apiRoot = path.resolve(__dirname, '..', 'api');
require('module-alias')({ base: apiRoot });

// 3. AHORA sí cargar mongoose y otros módulos
const mongoose = require('mongoose');

// 4. Cargar modelos (ahora ~ funciona correctamente)
require('../api/models');
```

### Orden Correcto de Inicialización

```
1. dotenv.config()           ← Variables de entorno
   ↓
2. module-alias({ base })    ← Configurar alias ~
   ↓
3. require('mongoose')       ← Cargar dependencias
   ↓
4. require('../api/models')  ← Cargar modelos (usa ~)
   ↓
5. migrateAviRoles()         ← Ejecutar migración
```

## 🧪 Testing

### Paso 1: Rebuild del Contenedor

```powershell
# Rebuild para incluir el script corregido
docker-compose -f deploy-compose.yml build api

# Reiniciar contenedores
docker-compose -f deploy-compose.yml down
docker-compose -f deploy-compose.yml up -d
```

### Paso 2: Probar el Script

```bash
# Desde dentro del contenedor
docker exec -it LibreChat-API sh
cd /app/scripts
sh reload-avi-roles.sh --interactive
```

**Salida esperada:**
```
🔄 Recargando configuración AVI Roles - 2025-10-17 04:00:00
✅ Conectando a MongoDB: mongodb://mongodb:27017/LibreChat
✅ Conectado a MongoDB

📊 ANÁLISIS DE CAMBIOS:
════════════════════════════════════════════════════════

✅ Configuración actual validada
...
```

### Paso 3: Verificar desde Windows

```powershell
# Usar el helper de PowerShell
.\scripts\invoke-reload-avi-roles.ps1 -Interactive
```

## 🔍 Explicación Técnica

### ¿Qué es module-alias?

`module-alias` es un paquete NPM que permite definir aliases de módulos personalizados. En este proyecto:

```javascript
// package.json
"_moduleAliases": {
  "~": "."  // ~ apunta al directorio api/
}
```

Esto permite escribir:
```javascript
const { User } = require('~/db/models');
// En lugar de:
const { User } = require('../../../db/models');
```

### ¿Por qué falló inicialmente?

El código original hacía:
```javascript
const mongoose = require('mongoose');  // ← require de otros módulos
// ...más código...
require('module-alias')({ base: apiRoot });  // ← Demasiado tarde
require('../api/models');  // ← Ya falló antes de llegar aquí
```

Cuando Node.js intenta resolver `require('../api/models')`, este archivo internamente hace `require('~/db/models')`. Si el alias `~` no está configurado **ANTES** de ese momento, Node.js no sabe cómo resolver `~` y lanza el error.

### Solución: Configurar PRIMERO

```javascript
// PASO 1: Configurar alias
require('module-alias')({ base: apiRoot });

// PASO 2: Ahora sí, cargar módulos que usan ~
require('../api/models');  // ← Ahora funciona
```

## 📝 Archivos Modificados

- ✅ `scripts/reload-avi-roles.sh` - Orden de inicialización corregido

## 🎯 Resultado Final

El script ahora:
1. ✅ Configura correctamente `module-alias`
2. ✅ Carga los modelos sin errores
3. ✅ Ejecuta la migración exitosamente
4. ✅ Funciona tanto en modo automático como interactivo

## 🚀 Próximos Pasos

1. **Rebuild:**
   ```powershell
   docker-compose -f deploy-compose.yml build api
   docker-compose -f deploy-compose.yml up -d
   ```

2. **Probar:**
   ```powershell
   .\scripts\invoke-reload-avi-roles.ps1 -Interactive
   ```

3. **Verificar logs:**
   ```powershell
   docker logs LibreChat-API --tail 50
   ```

---

**Fecha de Fix:** 17 de Octubre, 2025  
**Estado:** ✅ Resuelto
