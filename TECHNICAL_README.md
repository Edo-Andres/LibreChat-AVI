# LibreChat-AVI - Documentación Técnica Detallada

## Resumen Ejecutivo

LibreChat-AVI es un fork personalizado de LibreChat, una plataforma de chat de IA de código abierto que permite la integración con múltiples proveedores de modelos de IA. Esta versión incluye personalizaciones específicas para el equipo AVI, incluyendo integración con PostHog para analytics y configuraciones de interfaz adaptadas.

## Arquitectura General

LibreChat-AVI sigue una arquitectura de microservicios con separación clara entre backend y frontend:

- **Backend (API)**: Servidor Express.js con Node.js
- **Frontend (Client)**: Aplicación React con Vite
- **Base de Datos**: MongoDB con Mongoose ODM
- **Cache**: Redis para sesiones y caching
- **Almacenamiento**: Soporte para AWS S3 y Firebase
- **Autenticación**: Passport.js con múltiples estrategias (OAuth, LDAP, JWT)

### Diagrama de Arquitectura

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend API   │    │   Base de Datos │
│   (React/Vite)  │◄──►│  (Express.js)   │◄──►│    (MongoDB)    │
│                 │    │                 │    │                 │
│ - UI Components │    │ - Routes        │    │ - Usuarios      │
│ - State Mgmt    │    │ - Controllers   │    │ - Conversaciones│
│ - Analytics     │    │ - Services      │    │ - Config        │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │   Servicios     │
                    │   Externos      │
                    │                 │
                    │ - AI Providers  │
                    │ - Redis Cache   │
                    │ - File Storage  │
                    │ - Email Service │
                    └─────────────────┘
```

## Estructura del Proyecto

```
librechat-avi/
├── api/                          # Backend API
│   ├── app/                      # Configuración de la aplicación
│   ├── cache/                    # Lógica de cache
│   ├── config/                   # Configuraciones específicas de API
│   ├── lib/                      # Librerías compartidas
│   ├── logs/                     # Archivos de log
│   ├── models/                   # Modelos de MongoDB (Mongoose)
│   ├── server/                   # Servidor principal
│   │   ├── controllers/          # Controladores de rutas
│   │   ├── middleware/           # Middleware personalizado
│   │   ├── routes/               # Definición de rutas
│   │   ├── services/             # Servicios de negocio
│   │   └── utils/                # Utilidades del servidor
│   ├── strategies/               # Estrategias de autenticación (Passport)
│   ├── test/                     # Tests del backend
│   └── utils/                    # Utilidades generales
├── client/                       # Frontend React
│   ├── public/                   # Assets estáticos
│   ├── src/
│   │   ├── components/           # Componentes React
│   │   ├── hooks/                # Hooks personalizados
│   │   ├── lib/                  # Librerías frontend
│   │   ├── locales/              # Traducciones i18n
│   │   ├── routes/               # Configuración de rutas
│   │   ├── store/                # Estado global (Recoil)
│   │   ├── utils/                # Utilidades frontend
│   │   └── Providers/            # Context Providers
│   └── test/                     # Tests del frontend
├── packages/                     # Paquetes compartidos
│   ├── data-provider/            # Proveedor de datos
│   ├── data-schemas/             # Esquemas de datos
│   └── mcp/                      # Model Context Protocol
├── config/                       # Scripts de configuración y gestión
│   ├── health-check/             # Servicios de health check
│   ├── services/                 # Servicios de configuración
│   └── translations/             # Archivos de traducción
├── docker/                       # Configuraciones Docker
├── helm/                         # Charts de Kubernetes
├── e2e/                          # Tests end-to-end
└── utils/                        # Utilidades del proyecto
```

## Stack Tecnológico

### Backend (API)

**Framework Principal:**
- Node.js (v18+ recomendado)
- Express.js v4.21.2 - Framework web
- Bun (alternativo para desarrollo)

**Base de Datos y Cache:**
- MongoDB v8.12.1 - Base de datos principal
- Mongoose - ODM para MongoDB
- Redis v5.3.2 - Cache y sesiones
- MeiliSearch v0.38.0 - Búsqueda full-text

**Autenticación y Seguridad:**
- Passport.js v0.6.0 - Middleware de autenticación
- JWT (jsonwebtoken v9.0.0) - Tokens JWT
- bcryptjs v2.4.3 - Hashing de contraseñas
- express-rate-limit v7.4.1 - Rate limiting
- express-mongo-sanitize v2.2.0 - Sanitización MongoDB

**Proveedores de IA:**
- OpenAI v4.96.2
- Anthropic SDK v0.37.0
- Google Generative AI v0.23.0
- Cohere AI v7.9.1
- LangChain v0.3.44 (Community & Core)
- Ollama v0.5.0
- Y muchos más...

**Otros:**
- Winston v3.11.0 - Logging
- Nodemailer v6.9.15 - Email
- Sharp v0.33.5 - Procesamiento de imágenes
- Multer v2.0.0 - File uploads
- Axios v1.8.2 - HTTP client

### Frontend (Client)

**Framework Principal:**
- React v18.2.0
- Vite v6.3.4 - Build tool
- TypeScript v5.3.3

**UI y Estilos:**
- Tailwind CSS v3.4.1 - Framework CSS
- Radix UI - Componentes primitivos
- Headless UI v2.1.2 - Componentes headless
- Framer Motion v11.5.4 - Animaciones
- Lucide React v0.394.0 - Iconos

**Estado y Datos:**
- Recoil v0.7.7 - State management
- TanStack Query v4.28.0 - Data fetching
- React Hook Form v7.43.9 - Form management
- Zod v3.22.4 - Schema validation

**Internacionalización:**
- i18next v24.2.2 - i18n framework
- react-i18next v15.4.0

**Analytics:**
- PostHog v1.258.2 - Product analytics

**Otros:**
- React Router DOM v6.11.2 - Routing
- React Markdown v9.0.1 - Markdown rendering
- React Speech Recognition v3.10.0 - Speech-to-text
- SSE.js v2.5.0 - Server-sent events

### Paquetes Compartidos

**data-provider**: Abstracción de proveedores de datos
**data-schemas**: Validación de esquemas con Zod
**mcp**: Soporte para Model Context Protocol

## Configuración y Despliegue

### Variables de Entorno

**Backend (.env):**
```env
# Base de datos
MONGO_URI=mongodb://localhost:27017/librechat
REDIS_URI=redis://localhost:6379

# Autenticación
JWT_SECRET=your-secret-key
JWT_REFRESH_SECRET=your-refresh-secret

# Proveedores de IA
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Email
EMAIL_SERVICE=gmail
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# PostHog (AVI customization)
POSTHOG_KEY=your-posthog-key
POSTHOG_HOST=https://app.posthog.com
```

**Frontend (.env):**
```env
VITE_API_URL=http://localhost:3080
VITE_PUBLIC_POSTHOG_KEY=your-posthog-key
VITE_PUBLIC_POSTHOG_HOST=https://app.posthog.com
```

### Archivo de Configuración (librechat.yaml)

```yaml
version: 1.2.1
cache: true

interface:
  runCode: false
  customWelcome: "Welcome to LibreChat AVI!"
  endpointsMenu: false
  modelSelect: true
  parameters: false
  sidePanel: true
  presets: false
  prompts: false
  bookmarks: true
  multiConvo: false
  agents: true

registration:
  socialLogins: ['github', 'google', 'discord']

actions:
  allowedDomains:
    - "swapi.dev"
    - "librechat.ai"
```

## Desarrollo

### Requisitos Previos

- Node.js v18+
- MongoDB
- Redis
- Git

### Estructura de la Base de Datos

**Colecciones principales:**
- `users` - Usuarios del sistema
- `conversations` - Conversaciones de chat
- `messages` - Mensajes individuales
- `presets` - Configuraciones predefinidas
- `agents` - Agentes de IA
- `files` - Archivos subidos
- `tokens` - Tokens de uso de API

**Índices importantes:**
- Conversaciones por usuario
- Mensajes por conversación
- Búsqueda full-text en mensajes

#### Acceso a MongoDB con Docker

**1. Verificar que los contenedores estén corriendo:**
```bash
docker ps
```

**2. Acceder al contenedor de MongoDB:**
```bash
docker exec -it chat-mongodb mongosh LibreChat
```

**3. Ver la estructura de la colección `users`:**
```javascript
// Ver un documento de ejemplo
db.users.findOne()

// Ver la estructura completa de un usuario
db.users.findOne().pretty()

// Ver todos los campos disponibles en la colección
db.users.find().limit(1).forEach(doc => {
  for (let key in doc) {
    print(key + ": " + typeof doc[key]);
  }
})
```

#### Atributos de la Colección `users`

Basado en el esquema de Mongoose (`packages/data-schemas/src/schema/user.ts`):

**Campos principales:**
- `_id`: ObjectId (autogenerado)
- `name`: String (opcional) - Nombre completo del usuario
- `username`: String (opcional, lowercase) - Nombre de usuario único
- `email`: String (requerido, único, lowercase) - Email del usuario
- `emailVerified`: Boolean (default: false) - Si el email está verificado
- `password`: String (opcional, 8-128 chars) - Contraseña hasheada
- `avatar`: String (opcional) - URL del avatar
- `provider`: String (requerido, default: 'local') - Proveedor de autenticación
- `role`: String (default: 'USER') - Rol del usuario (USER, ADMIN, etc.)

**Campos de autenticación OAuth:**
- `googleId`: String (único, sparse)
- `facebookId`: String (único, sparse)
- `openidId`: String (único, sparse)
- `ldapId`: String (único, sparse)
- `githubId`: String (único, sparse)
- `discordId`: String (único, sparse)
- `appleId`: String (único, sparse)

**Campos de seguridad:**
- `twoFactorEnabled`: Boolean (default: false) - 2FA habilitado
- `totpSecret`: String - Secreto para TOTP
- `backupCodes`: Array - Códigos de respaldo para 2FA
- `refreshToken`: Array - Tokens de refresh para sesiones

**Campos adicionales:**
- `plugins`: Array - Plugins habilitados para el usuario
- `termsAccepted`: Boolean (default: false) - Términos aceptados
- `expiresAt`: Date - Fecha de expiración (7 días)
- `createdAt`: Date - Fecha de creación
- `updatedAt`: Date - Fecha de última actualización

#### Crear un Nuevo Usuario

**Método 1: Usando el script incluido (Recomendado)**
```bash
# Crear usuario con email verificado (default)
npm run create-user usuario@email.com "Nombre Completo" nombreusuario

# Crear usuario sin verificar email
npm run create-user usuario@email.com "Nombre Completo" nombreusuario --email-verified=false

# Crear usuario con contraseña específica (no recomendado por seguridad)
npm run create-user usuario@email.com "Nombre Completo" nombreusuario mipassword
```

**Método 2: Usando MongoDB directamente (para desarrollo/testing)**
```javascript
// Conectar a MongoDB
docker exec -it chat-mongodb mongosh LibreChat

// Insertar usuario básico
db.users.insertOne({
  name: "Usuario de Prueba",
  username: "testuser",
  email: "test@example.com",
  emailVerified: true,
  password: "$2a$10$encryptedpasswordhash", // Debes generar un hash bcrypt
  provider: "local",
  role: "USER",
  termsAccepted: true,
  createdAt: new Date(),
  updatedAt: new Date()
})

// Insertar usuario con OAuth (ejemplo Google)
db.users.insertOne({
  name: "Usuario Google",
  email: "google@example.com",
  emailVerified: true,
  googleId: "123456789",
  provider: "google",
  role: "USER",
  termsAccepted: true,
  createdAt: new Date(),
  updatedAt: new Date()
})
```

**Método 3: Usando Node.js script personalizado**
```javascript
// crear-usuario-manual.js
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./api/models/User');

async function createUser() {
  try {
    await mongoose.connect('mongodb://localhost:27017/LibreChat');
    
    const hashedPassword = await bcrypt.hash('tu_password_seguro', 10);
    
    const user = new User({
      name: 'Usuario Manual',
      username: 'usuariomanual',
      email: 'manual@example.com',
      emailVerified: true,
      password: hashedPassword,
      provider: 'local',
      role: 'USER',
      termsAccepted: true
    });
    
    await user.save();
    console.log('Usuario creado exitosamente');
    
    await mongoose.disconnect();
  } catch (error) {
    console.error('Error creando usuario:', error);
  }
}

createUser();
```

#### Comandos Útiles para Gestión de Usuarios

**Ver todos los usuarios:**
```javascript
db.users.find().pretty()
```

**Buscar usuario por email:**
```javascript
db.users.findOne({email: "usuario@email.com"})
```

**Actualizar usuario:**
```javascript
db.users.updateOne(
  {email: "usuario@email.com"},
  {$set: {name: "Nuevo Nombre"}}
)
```

**Eliminar usuario:**
```javascript
db.users.deleteOne({email: "usuario@email.com"})
```

**Ver estadísticas de usuarios:**
```javascript
db.users.countDocuments()
db.users.find({role: "ADMIN"}).count()
```

#### Notas Importantes

1. **Siempre hashea las contraseñas** cuando las insertes manualmente usando bcrypt
2. **Los campos únicos** (email, username, IDs de OAuth) deben ser únicos en la base de datos
3. **El campo `provider`** indica cómo se autenticó el usuario (local, google, github, etc.)
4. **Los campos OAuth** son `sparse`, lo que significa que pueden ser null/undefined sin ocupar espacio
5. **Usa los scripts incluidos** (`npm run create-user`) para creación segura de usuarios en producción

## Características Personalizadas (AVI)

### Integración con PostHog

- Analytics de producto integrado
- Seguimiento de eventos de usuario
- Métricas de uso de IA
- Configurado en `client/src/Providers/PostHogProvider.tsx`

### Configuración de Interfaz

- Interfaz personalizada para AVI
- Deshabilitación de ciertos menús (endpoints, parameters, presets)
- Habilitación de agentes y bookmarks
- Mensaje de bienvenida personalizado

### Scripts de Gestión

- Scripts avanzados en `config/` para:
  - Gestión de usuarios y balances
  - Health checks con notificaciones
  - Exportación de datos a Google Sheets
  - Sincronización de chats

## Despliegue

### Docker

```bash
# Desarrollo
docker-compose -f deploy-compose-dokploy.yml up

# Producción
docker-compose -f deploy-compose-dokploy.yml up -d
```


## Monitoreo y Logging

### Health Checks

- Endpoint `/health` para verificación básica
- Scripts en `config/health-check/` para monitoreo avanzado
- Notificaciones por email para alertas

### Logging

- Winston para logging estructurado
- Niveles: error, warn, info, debug
- Rotación automática de archivos de log
- Logs separados por entorno

## Seguridad

### Medidas Implementadas

- Rate limiting en API
- Sanitización de inputs MongoDB
- Validación con Zod
- Autenticación JWT
- Encriptación de contraseñas
- CSP (Content Security Policy) - temporalmente removido

### Mejores Prácticas

- Nunca commitear secrets
- Usar variables de entorno
- Validar inputs en cliente y servidor
- Mantener dependencias actualizadas

## Contribución

### Guías de Desarrollo

1. Seguir convenciones de código (ESLint, Prettier)
2. Escribir tests para nuevas funcionalidades
3. Actualizar documentación
4. Usar conventional commits

### Ramas

- `main`/`master`: Rama principal
- `posthog`: Rama con integración de analytics
- Feature branches: `feature/nombre-funcionalidad`

### Code Review

- Pull requests requieren aprobación
- Tests deben pasar
- Linting debe pasar
- Documentación actualizada

## Troubleshooting

### Problemas Comunes

**Error de conexión a MongoDB:**
- Verificar que MongoDB esté corriendo
- Revisar `MONGO_URI` en .env

**Error de build del frontend:**
- Limpiar node_modules: `npm run reinstall`
- Verificar versiones de Node.js

**Problemas con PostHog:**
- Verificar `VITE_PUBLIC_POSTHOG_KEY`
- Revisar configuración en PostHogProvider

### Logs y Debugging

- Logs del backend: `api/logs/`
- Logs del frontend: Browser console
- Debug mode: `NODE_ENV=development`

## Soporte

- **Documentación**: [docs.librechat.ai](https://docs.librechat.ai)
- **Issues**: GitHub Issues
- **Discord**: [discord.librechat.ai](https://discord.librechat.ai)

---

*Esta documentación es específica para LibreChat-AVI. Para la documentación general de LibreChat, visitar [docs.librechat.ai](https://docs.librechat.ai).*</content>
<parameter name="filePath">d:\Proyectos\LibreChat-AVI\TECHNICAL_README.md