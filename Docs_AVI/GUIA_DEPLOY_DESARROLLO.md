# 🚀 Guía de Deploy y Desarrollo - LibreChat-AVI

**Versión:** v0.8.0-rc4  
**Fecha:** Octubre 2025  
**Proyecto:** LibreChat-AVI - Asistente Virtual en Infancia

---

## 📋 Tabla de Contenidos

1. [Requisitos Previos](#requisitos-previos)
2. [Configuración Inicial](#configuración-inicial)
3. [Deploy en Producción (Dokploy)](#deploy-en-producción-dokploy)
4. [Desarrollo Local](#desarrollo-local)
5. [Gestión de Roles AVI](#gestión-de-roles-avi)
6. [Comandos Principales](#comandos-principales)
7. [Troubleshooting](#troubleshooting)

---

## 🔧 Requisitos Previos

### Software Necesario
- **Docker** >= 20.10
- **Docker Compose** >= 2.0
- **Node.js** >= 20.x (para desarrollo local)
- **Git**
- **npm** >= 10.x

### Infraestructura
- **Producción:** Dokploy (Digital Ocean Droplet con backups automáticos)
- **Desarrollo:** Docker local o Node.js + MongoDB local

---

## ⚙️ Configuración Inicial

### 1. Clonar el Repositorio

```bash
# Rama master para producción
git clone -b master https://github.com/Edo-Andres/LibreChat-AVI.git

# Rama dev para desarrollo
git clone -b dev https://github.com/Edo-Andres/LibreChat-AVI.git
```

### 2. Configurar Variables de Entorno

```bash
# Copiar el ejemplo
cp .env.example .env
```

**Variables críticas en `.env`:**

```bash
# Server
HOST=localhost
PORT=3080

# MongoDB (Desarrollo Local)
MONGO_URI=mongodb://127.0.0.1:27017/LibreChat

# MongoDB (Docker)
# MONGO_URI=mongodb://mongodb:27017/LibreChat

# MeiliSearch
MEILI_MASTER_KEY=tu-clave-segura
MEILI_HOST=http://0.0.0.0:7700

# Security
JWT_SECRET=tu-jwt-secret-largo-y-seguro
JWT_REFRESH_SECRET=tu-refresh-secret-largo-y-seguro

# AI Endpoints (según necesites)
# OPENAI_API_KEY=sk-...
# ANTHROPIC_API_KEY=...
```

### 3. Configurar `librechat.yaml`

El archivo ya incluye:
- ✅ **AVI Roles** dinámicos
- ✅ **Terms of Service** personalizados
- ✅ **Interface** personalizada

**No requiere modificación** a menos que cambies roles.

---

## 🌐 Deploy en Producción (Dokploy)

### Estrategia de Ramas
- **`master`**: Producción estable
- **`dev`**: Desarrollo y testing

### Deploy con Dokploy

```yaml
# Configuración en Dokploy UI
Repository: https://github.com/Edo-Andres/LibreChat-AVI.git
Branch: master

# Build Command
docker-compose -f deploy-compose-dokploy.yml up -d --build
```

### Deploy Manual

```bash
# SSH al servidor
ssh usuario@ip-servidor

# Actualizar código
cd /ruta/proyecto/LibreChat-AVI
git pull origin master

# Deploy
docker-compose -f deploy-compose-dokploy.yml up -d --build

# Verificar
docker-compose -f deploy-compose-dokploy.yml ps
docker-compose -f deploy-compose-dokploy.yml logs -f api
```

---

## 💻 Desarrollo Local

### Opción 1: Desarrollo con Docker (Completo)

**Ideal para:** Testing completo del sistema

```bash
# Iniciar todos los servicios
docker-compose -f deploy-compose-dev.yml up -d

# Ver logs
docker-compose -f deploy-compose-dev.yml logs -f

# Acceder
http://localhost:3080

# Detener
docker-compose -f deploy-compose-dev.yml down
```

**Servicios incluidos:**
- ✅ MongoDB (puerto 27017 expuesto)
- ✅ MeiliSearch (puerto 7700 expuesto)
- ✅ VectorDB (PostgreSQL)
- ✅ RAG API

**Nota:** El servicio `api` está deshabilitado - lo ejecutas localmente con `npm run backend:dev`

---

### Opción 2: Desarrollo Local Sin Docker (Rápido)

**Ideal para:** Desarrollo activo con hot-reload

#### Setup Inicial

```bash
# 1. Instalar dependencias
npm ci

# 2. Compilar packages
cd packages/data-schemas
npm run build
cd ../..

# 3. Levantar servicios de base de datos
docker-compose -f deploy-compose-dev.yml up -d
```

#### Flujo de Trabajo

```bash
# Terminal 1: Backend con hot-reload
npm run backend:dev

# Terminal 2: Frontend con hot-reload
npm run frontend:dev

# Acceder al frontend
http://localhost:3090
```

**Ventajas:**
- ⚡ Hot-reload automático en backend y frontend
- 🔄 Cambios visibles inmediatamente
- 🐛 Debugging más fácil
- 📝 Logs directos en terminal

---

## 🎭 Gestión de Roles AVI

### Sistema de Roles Dinámico

Los roles AVI se configuran en `librechat.yaml` con:
- **knowledge**: Conocimiento esperado del rol
- **behavior**: Comportamiento esperado del rol
- **subroles**: Subroles jerárquicos

### Aplicar Cambios en Roles

Cuando modificas `librechat.yaml`, **debes sincronizar con MongoDB**:

#### 📍 **Desarrollo Local (npm run backend:dev)**

```powershell
# Método 1: Script standalone (Recomendado)
node config/reload-avi-roles-standalone.js -i

# Método 2: Script standalone sin confirmación
node config/reload-avi-roles-standalone.js
```

**Características:**
- ✅ Se ejecuta fuera del servidor
- ✅ No requiere Docker
- ✅ Modo interactivo con confirmación
- ✅ Conecta directamente a MongoDB local

---

#### 🐳 **Docker (Desarrollo o Producción)**

```bash
# Método 1: Script dentro del contenedor (Recomendado)
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"

# Método 2: Sin confirmación
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh"

# Método 3: Reiniciar contenedor (más lento)
docker-compose -f deploy-compose.yml restart api
```

---

### Matriz de Comandos por Entorno

| Entorno | Cambio en `librechat.yaml` | Comando |
|---------|---------------------------|---------|
| **Desarrollo Local** (`npm run backend:dev`) | ✏️ Editar roles | `node config/reload-avi-roles-standalone.js -i` |
| **Docker Dev** | ✏️ Editar roles | `docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"` |
| **Docker Producción** | ✏️ Editar roles | `docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"` |

---

### Ejemplo: Agregar Nuevo Rol

**1. Editar `librechat.yaml`:**

```yaml
aviRoles:
  roles:
    - name: Psicologo
      knowledge: "Conocimiento en psicología infantil y trauma"
      behavior: "Empático, profesional, confidencial"
      subroles:
        - Psicólogo Clínico
        - Psicólogo Educacional
```

**2. Aplicar cambios:**

```powershell
# Si estás en desarrollo local
node config/reload-avi-roles-standalone.js -i

# Si estás en Docker
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"
```

**3. Verificar:**

El script mostrará:
```
📊 ANÁLISIS DE CAMBIOS:
═══════════════════════════════════════

➕ ROLES NUEVOS (1):
   • Psicologo

¿Desea continuar con la migración? (y/n): y

🔧 APLICANDO CAMBIOS...
   ✅ Creado: Psicologo
   ✅ Subrol creado: "Psicólogo Clínico" (padre: Psicologo)
   ✅ Subrol creado: "Psicólogo Educacional" (padre: Psicologo)

✅ Configuración actualizada exitosamente
```

---

## 📦 Comandos Principales

### Docker

```bash
# ═══════════════════════════════════════
# DESARROLLO CON DOCKER
# ═══════════════════════════════════════

# Iniciar servicios (sin API)
docker-compose -f deploy-compose-dev.yml up -d

# Ver logs
docker-compose -f deploy-compose-dev.yml logs -f mongodb
docker-compose -f deploy-compose-dev.yml logs -f meilisearch

# Detener
docker-compose -f deploy-compose-dev.yml down

# ═══════════════════════════════════════
# PRODUCCIÓN
# ═══════════════════════════════════════

# Deploy completo
docker-compose -f deploy-compose-dokploy.yml up -d --build

# Ver logs
docker-compose -f deploy-compose-dokploy.yml logs -f api

# Reiniciar servicio específico
docker-compose -f deploy-compose-dokploy.yml restart api
```

---

### NPM - Desarrollo

```bash
# ═══════════════════════════════════════
# BACKEND
# ═══════════════════════════════════════

# Backend con hot-reload (desarrollo)
npm run backend:dev

# Backend producción
npm run backend

# Detener backend
npm run backend:stop

# ═══════════════════════════════════════
# FRONTEND
# ═══════════════════════════════════════

# Frontend con hot-reload (desarrollo rápido)
npm run frontend:dev

# Build frontend para producción
npm run frontend

# ═══════════════════════════════════════
# COMPILACIÓN DE PACKAGES
# ═══════════════════════════════════════

# Compilar data-schemas (TypeScript)
cd packages/data-schemas && npm run build

# Compilar data-provider
cd packages/data-provider && npm run build

# ═══════════════════════════════════════
# GESTIÓN DE USUARIOS
# ═══════════════════════════════════════

# Crear usuario
npm run create-user

# Invitar usuario (envía email)
npm run invite-user

# Listar usuarios
npm run list-users

# Resetear contraseña
npm run reset-password

# Banear usuario
npm run ban-user

# Eliminar usuario
npm run delete-user
```

---

### Scripts AVI (MongoDB)

```bash
# ═══════════════════════════════════════
# DESARROLLO LOCAL
# ═══════════════════════════════════════

# Recargar roles AVI (con confirmación)
node config/reload-avi-roles-standalone.js -i

# Recargar roles AVI (automático)
node config/reload-avi-roles-standalone.js

# Probar variables knowledge/behavior
node config/test-knowledge-behavior-variables.js

# ═══════════════════════════════════════
# DOCKER (DESARROLLO O PRODUCCIÓN)
# ═══════════════════════════════════════

# Recargar roles AVI (con confirmación)
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"

# Recargar roles AVI (automático)
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh"
```

---

## 🔧 Troubleshooting

### Backend no inicia

```bash
# Verificar MongoDB
docker-compose -f deploy-compose-dev.yml ps

# Ver logs de MongoDB
docker-compose -f deploy-compose-dev.yml logs mongodb

# Verificar conexión
mongosh mongodb://127.0.0.1:27017/LibreChat
```

---

### Cambios en TypeScript no se aplican

```bash
# Compilar el paquete modificado
cd packages/data-schemas
npm run build
cd ../..

# Nodemon reiniciará automáticamente
```

---

### Roles no se actualizan

```bash
# Verificar que ejecutaste el script de migración
node config/reload-avi-roles-standalone.js -i

# Verificar en MongoDB
mongosh mongodb://127.0.0.1:27017/LibreChat
> use LibreChat
> db.aviroles.find().pretty()
```

---

### Frontend no recarga automáticamente

```bash
# Verificar que Vite está corriendo
npm run frontend:dev

# Debe mostrar:
# ➜  Local:   http://localhost:3090/
# ➜  Network: use --host to expose
```

---

## 🎯 Flujos de Trabajo Recomendados

### Desarrollo de Nueva Feature

```bash
# 1. Levantar bases de datos
docker-compose -f deploy-compose-dev.yml up -d

# 2. Iniciar backend
npm run backend:dev

# 3. Iniciar frontend (otra terminal)
npm run frontend:dev

# 4. Editar código
# Los cambios se ven automáticamente

# 5. Si modificas TypeScript en packages/
cd packages/data-schemas
npm run build
# Nodemon reiniciará el backend automáticamente
```

---

### Cambio en Roles AVI

```bash
# 1. Editar librechat.yaml
# Agregar/modificar roles y subroles

# 2. Aplicar cambios a MongoDB
node config/reload-avi-roles-standalone.js -i

# 3. Confirmar migración (y/n)
# El servidor reiniciará automáticamente

# 4. Verificar en la aplicación
# Los nuevos roles están disponibles inmediatamente
```

---

### Testing Completo Pre-Deploy

```bash
# 1. Build completo con Docker
docker-compose -f deploy-compose.yml up -d --build

# 2. Verificar servicios
docker-compose -f deploy-compose.yml ps

# 3. Ver logs
docker-compose -f deploy-compose.yml logs -f api

# 4. Acceder y probar
http://localhost:3080

# 5. Detener
docker-compose -f deploy-compose.yml down
```

---

## 📚 Documentación Relacionada

### Interna AVI
- `Docs_AVI/AVI_ROLES_DOCUMENTATION.md` - Sistema de roles completo
- `Docs_AVI/IMPLEMENTACION_VARIABLES_AVI.md` - Variables en prompts
- `Docs_AVI/README_HEALTH_CHECK_AUDIT.md` - Health checks

### Oficial LibreChat
- [Configuration Guide](https://www.librechat.ai/docs/configuration/librechat_yaml)
- [Environment Variables](https://www.librechat.ai/docs/configuration/dotenv)
- [Docker Deployment](https://www.librechat.ai/docs/deployment/docker)

---

## ✨ Resumen de Comandos Rápidos

```bash
# ══════════════════════════════════════════════════════
# DESARROLLO LOCAL (Más Común)
# ══════════════════════════════════════════════════════

# Iniciar bases de datos
docker-compose -f deploy-compose-dev.yml up -d

# Backend con hot-reload
npm run backend:dev

# Frontend con hot-reload (otra terminal)
npm run frontend:dev

# Recargar roles AVI
node config/reload-avi-roles-standalone.js -i

# Compilar TypeScript (si modificas packages/)
cd packages/data-schemas && npm run build

# ══════════════════════════════════════════════════════
# DOCKER PRODUCCIÓN
# ══════════════════════════════════════════════════════

# Deploy completo
docker-compose -f deploy-compose-dokploy.yml up -d --build

# Recargar roles
docker exec -it LibreChat-API sh -c "./scripts/reload-avi-roles.sh -i"

# Ver logs
docker-compose -f deploy-compose-dokploy.yml logs -f api
```

---

**Documentación creada para:** LibreChat-AVI v0.8.0-rc4  
**Mantenida por:** Equipo de Desarrollo AVI  
**Última actualización:** Octubre 2025
