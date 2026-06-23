# 📖 Sistema AVI Roles Dinámico - Guía de Uso

## 🎯 Descripción General

El Sistema AVI Roles Dinámico permite gestionar roles y subroles de usuario sin necesidad de reconstruir los contenedores Docker. La configuración se realiza directamente en `librechat.yaml` y se aplica mediante scripts de migración.

## ✨ Características Principales

- ✅ **Configuración dinámica**: Edita roles en `librechat.yaml` sin rebuild
- ✅ **Migración automática**: Renombra roles/subroles manteniendo datos de usuarios
- ✅ **Validación robusta**: Múltiples capas de validación y fallbacks
- ✅ **Integridad referencial**: Corrección automática de referencias huérfanas
- ✅ **Modo interactivo**: Vista previa de cambios antes de aplicar
- ✅ **Transacciones**: Rollback automático en caso de error

## 📁 Archivos del Sistema

### Archivos Principales
```
config/
  └── avi-roles-config.js        # Lógica de migración y validación

scripts/
  ├── reload-avi-roles.sh        # Script bash (ejecuta en contenedor)
  └── invoke-reload-avi-roles.ps1 # Helper PowerShell (Windows)

packages/data-schemas/src/methods/
  ├── aviRol.ts                   # Métodos dinámicos para roles
  └── aviSubrol.ts                # Métodos dinámicos para subroles

librechat.yaml                    # Configuración principal (sección aviRoles)
```

## ⚙️ Configuración en `librechat.yaml`

### Estructura Básica

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

  migrations:
    roles: {}
    subroles: {}
    defaultRoleForOrphans: generico
```

### Configuración de Migraciones

#### Renombrar Roles

```yaml
aviRoles:
  roles:
    - name: usuario_basico      # Nuevo nombre
      subroles:
        - Ver
        - Comentar

  migrations:
    roles:
      generico: usuario_basico  # antiguo: nuevo
```

**Resultado:**
- El rol `generico` se renombra a `usuario_basico`
- El `_id` en MongoDB se mantiene (no se crea un nuevo rol)
- Los usuarios siguen apuntando al mismo rol (sin cambios en `aviRol_id`)

#### Renombrar Subroles

```yaml
aviRoles:
  roles:
    - name: generico
      subroles:
        - Ver           # Nuevo nombre
        - Comentar      # Nuevo nombre

  migrations:
    subroles:
      Lector: Ver           # antiguo: nuevo
      Comentarista: Comentar
```

#### Eliminar Subroles

```yaml
aviRoles:
  migrations:
    subroles:
      Asistente: null   # null = eliminar
```

**Resultado:**
- El subrol `Asistente` se elimina de la BD
- Usuarios con ese subrol: `aviSubrol_id` → `null`

#### Consolidar Subroles

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

**Resultado:**
- 3 subroles diferentes renombrados al mismo nombre
- Usuarios con cualquiera de los 3 → ahora tienen `SuperAdmin`

## 🚀 Métodos de Ejecución

### Método 1: Script PowerShell (Recomendado para Windows)

```powershell
# Modo automático (sin confirmación)
.\scripts\invoke-reload-avi-roles.ps1

# Modo interactivo (con vista previa y confirmación)
.\scripts\invoke-reload-avi-roles.ps1 -Interactive
```

### Método 2: Comando Docker Directo

```powershell
# Modo automático
docker exec LibreChat-API /app/scripts/reload-avi-roles.sh

# Modo interactivo
docker exec -it LibreChat-API /app/scripts/reload-avi-roles.sh --interactive
```

### Método 3: Dentro del Contenedor

```bash
# Acceder al contenedor
docker exec -it LibreChat-API sh

# Ejecutar script
cd /app
./scripts/reload-avi-roles.sh --interactive
```

## 📊 Ejemplo de Salida

### Modo Automático

```
🔄 Recargando configuración AVI Roles - 2025-10-17 10:30:00
✅ Conectado a MongoDB

📊 Configuración parseada correctamente
📋 Roles actuales en BD: 3
   - generico (ID: 67a8...1234)
   - cuidador (ID: 67a8...5678)
   - administrativo (ID: 67a8...9abc)

🔄 PASO 1: Migrando roles...
   🔄 Renombrando: "generico" → "usuario_basico"
      ✅ ID mantenido: 67a8...1234
   ✅ Rol "cuidador" sin cambios

🔄 PASO 2: Migrando subroles...
   📁 Procesando subroles de "usuario_basico":
      🔄 Renombrado: "Lector" → "Ver"
      🔄 Renombrado: "Comentarista" → "Comentar"
      🗑️  Eliminado: "Colaborador" (5 usuarios afectados)

🔍 PASO 3: Validando integridad referencial...
✅ Integridad referencial validada

✅ Migración completada exitosamente
👋 Desconectado de MongoDB
```

### Modo Interactivo

```
🔄 Recargando configuración AVI Roles - 2025-10-17 10:30:00
✅ Conectado a MongoDB

📊 ANÁLISIS DE CAMBIOS:
════════════════════════════════════════════════════════

🔄 RENOMBRES DE ROLES:
   • "generico" → "usuario_basico" (150 usuarios)
   • "administrativo" → "admin" (20 usuarios)

🔄 RENOMBRES DE SUBROLES:
   • "Lector" → "Ver" (85 usuarios)
   • "Comentarista" → "Comentar" (40 usuarios)

🗑️  SUBROLES A ELIMINAR:
   • "Colaborador" (25 usuarios → aviSubrol_id: null)
   • "Asistente" (10 usuarios → aviSubrol_id: null)

════════════════════════════════════════════════════════
📊 RESUMEN:
   • 2 roles renombrados
   • 2 subroles renombrados
   • 2 subroles eliminados
   • Total usuarios afectados: 330

¿Desea continuar con la migración? (y/n): _
```

## 🎯 Casos de Uso Comunes

### Caso 1: Renombrar un Rol Completo

**Objetivo:** Cambiar `generico` → `usuario_basico`

**Pasos:**
1. Editar `librechat.yaml`:
```yaml
aviRoles:
  roles:
    - name: usuario_basico
      subroles:
        - Ver
        - Comentar
  migrations:
    roles:
      generico: usuario_basico
    subroles:
      Lector: Ver
      Comentarista: Comentar
```

2. Ejecutar migración:
```powershell
.\scripts\invoke-reload-avi-roles.ps1 -Interactive
```

3. Revisar resumen y confirmar

### Caso 2: Agregar Nuevo Rol

**Objetivo:** Crear rol `premium` con subroles nuevos

**Pasos:**
1. Editar `librechat.yaml`:
```yaml
aviRoles:
  roles:
    - name: generico
      subroles: [Lector, Comentarista]
    - name: cuidador
      subroles: [Cuidador Principal, Asistente]
    - name: administrativo
      subroles: [Gestor de Usuarios, Configuración]
    - name: premium          # ← Nuevo rol
      subroles:
        - Acceso Completo
        - Editor Avanzado
```

2. Ejecutar migración:
```powershell
.\scripts\invoke-reload-avi-roles.ps1
```

### Caso 3: Eliminar Subroles Obsoletos

**Objetivo:** Mantener solo `Lector` en `generico`

**Pasos:**
1. Editar `librechat.yaml`:
```yaml
aviRoles:
  roles:
    - name: generico
      subroles:
        - Lector          # Solo este permanece
  migrations:
    subroles:
      Comentarista: null  # Eliminar
      Colaborador: null   # Eliminar
```

2. Ejecutar migración interactiva para ver usuarios afectados

## 🔧 Troubleshooting

### Error: "Contenedor no está corriendo"

```powershell
# Verificar estado
docker ps -a | Select-String "LibreChat-API"

# Iniciar contenedores
docker-compose -f deploy-compose.yml up -d
```

### Error: "Config debe tener al menos 1 rol"

```yaml
# ❌ Incorrecto
aviRoles:
  roles: []

# ✅ Correcto
aviRoles:
  roles:
    - name: generico
      subroles: [Lector]
```

### Error: "Roles duplicados en configuración"

```yaml
# ❌ Incorrecto
aviRoles:
  roles:
    - name: admin
      subroles: [Sub1]
    - name: admin        # ← Duplicado
      subroles: [Sub2]

# ✅ Correcto
aviRoles:
  roles:
    - name: admin
      subroles: [Sub1, Sub2]
```

### Error: "Conflicto: múltiples roles mapean al mismo nombre"

```yaml
# ❌ Incorrecto
aviRoles:
  migrations:
    roles:
      generico: admin
      administrativo: admin  # ← Conflicto

# ✅ Correcto (usar nombres únicos)
aviRoles:
  migrations:
    roles:
      generico: usuario_basico
      administrativo: admin
```

### Verificar Logs de Migración

```powershell
# Ver logs del contenedor
docker logs LibreChat-API --tail 100

# Ver logs en tiempo real
docker logs -f LibreChat-API
```

### Backup antes de Migración

```powershell
# Backup de MongoDB
docker exec chat-mongodb mongodump --out=/data/db/backup-$(Get-Date -Format "yyyyMMdd")

# Verificar backup
docker exec chat-mongodb ls -la /data/db/backup-*
```

## 🛡️ Validaciones Automáticas

El sistema incluye múltiples validaciones:

1. **Estructura de Config:**
   - Al menos 1 rol requerido
   - No roles con nombres duplicados
   - Subroles vacíos filtrados automáticamente

2. **Conflictos de Nombres:**
   - No permite múltiples roles con mismo nombre destino
   - Subroles con mismo nombre permitidos si tienen diferente `parentRolId`

3. **Integridad Referencial:**
   - Usuarios con `aviSubrol_id` pero sin `aviRol_id` → autocorrección
   - Subroles huérfanos (sin rol padre) → eliminación automática

4. **Transacciones:**
   - Rollback automático si falla cualquier paso
   - Estado de BD preservado en caso de error

## 📚 Referencias

- **Plan de Implementación:** `PLAN_IMPLEMENTACION_AVI_ROLES_DYNAMIC_FINAL.md`
- **Código Fuente:** `config/avi-roles-config.js`
- **Documentación LibreChat:** https://www.librechat.ai/docs/configuration/librechat_yaml

## 🤝 Soporte

Para problemas o preguntas:
- Revisar logs: `docker logs LibreChat-API`
- Verificar configuración: Validar sintaxis YAML
- Ejecutar en modo interactivo: Ver cambios antes de aplicar

---

**Fecha de Actualización:** 17 de Octubre, 2025  
**Versión:** 1.0.0
