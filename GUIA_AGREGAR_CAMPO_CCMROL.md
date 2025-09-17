# Guía Paso a Paso: Añadir Campo `ccmRol` a la Colección `users`

## 📋 Análisis del Proyecto LibreChat-AVI

Basado en el análisis detallado del proyecto, he identificado la siguiente estructura y flujo para añadir campos a la base de datos MongoDB:

### 🏗️ Arquitectura de la Base de Datos

**1. Definición de Esquemas:**
- Los esquemas están definidos en TypeScript en `packages/data-schemas/src/schema/`
- Se usan interfaces TypeScript (`IUser`) y esquemas Mongoose
- Los esquemas se exportan desde `packages/data-schemas/src/index.ts`

**2. Sistema de Modelos:**
- Los modelos Mongoose están en `api/models/`
- Importan los esquemas desde `@librechat/data-schemas`
- Ejemplo: `User.js` importa `userSchema`

**3. Sistema de Workspaces:**
- El proyecto usa workspaces de npm
- Los paquetes se construyen con Rollup
- Scripts de construcción: `npm run build:data-schemas`

**4. Configuración Docker:**
- MongoDB corre en contenedor `chat-mongodb`
- Sin autenticación (`--noauth`)
- Datos persistidos en `./data-node:/data/db`

**5. Scripts de Gestión:**
- Scripts en `config/` para operaciones de usuario
- Patrón: importar modelos, conectar DB, ejecutar operaciones
- Usan `module-alias` para resolver rutas `~/`

---

## 🚀 Guía Paso a Paso para Añadir `ccmRol`

### Paso 1: Análisis de Requisitos
**Respuestas específicas para `ccmRol`:**

- **¿Qué tipo de dato será `ccmRol`?** 
  - **R:** String (representa un rol como "SUPERVISOR", "MANAGER", etc.)

- **¿Será requerido u opcional?**
  - **R:** Opcional para que no afecte a los usuarios ya creados que no tienen el campo

- **¿Necesita validaciones específicas?**
  - **R:** No necesita validaciones específicas

- **¿Debe tener un valor por defecto?**
  - **R:** No por el momento, como existen usuarios registrados sin ese campo que debo tener cuidado que no se rompa nada

- **¿Será único o puede repetirse?**
  - **R:** El ccmRol puede repetirse, es decir uno o más usuarios puede tener el mismo ccmRol

### Paso 2: Modificar el Esquema TypeScript
**Archivo:** `packages/data-schemas/src/schema/user.ts`

**Acciones:**
1. Añadir `ccmRol?: string;` a la interfaz `IUser`
2. Añadir el campo al esquema Mongoose después del campo `role`

**Código a añadir:**
```typescript
// En la interfaz IUser (alrededor de línea 12)
role?: string;
ccmRol?: string;  // ← AÑADIR AQUÍ (opcional)
googleId?: string;
```

```typescript
// En el esquema Mongoose (alrededor de línea 96)
role: {
  type: String,
  default: SystemRoles.USER,
},
ccmRol: {           // ← AÑADIR AQUÍ
  type: String,
  required: false,  // Campo opcional
  trim: true,
  maxlength: 50     // Solo limitar longitud máxima
},
googleId: {
```

### Paso 3: Construir el Paquete
**Comando:**
```bash
npm run build:data-schemas
```

**Qué hace:**
- Limpia la carpeta `dist/`
- Compila TypeScript a JavaScript usando Rollup
- Genera archivos `.cjs`, `.es.js` y `.d.ts`
- Actualiza las exportaciones en `packages/data-schemas/dist/`

### Paso 4: Reiniciar la Aplicación
**Comandos:**
```bash
# Detener contenedores
docker-compose down

# Reconstruir y iniciar
docker-compose up --build -d
```

**Por qué:**
- Mongoose necesita "ver" el nuevo esquema al iniciar
- Los modelos se registran al importar el módulo
- Cambios en esquemas requieren reinicio de la aplicación

### Paso 5: Verificar el Esquema en MongoDB
**Acceder al contenedor:**
```bash
docker exec -it chat-mongodb mongosh LibreChat
```

**Comandos de verificación:**
```javascript
// Ver un usuario existente
db.users.findOne()

// Verificar que el campo existe (debería aparecer como undefined inicialmente)
db.users.findOne({}, {ccmRol: 1, email: 1})

// Contar usuarios sin el campo ccmRol
db.users.countDocuments({ccmRol: {$exists: false}})
```

### Paso 6: Crear Script de Migración
**Archivo:** `config/migrate-add-ccmRol.js`

**Contenido del script:**
```javascript
const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const User = require('~/models/User');
const connect = require('./connect');

async function migrateUsers() {
  await connect();

  console.log('🚀 Iniciando migración para añadir campo ccmRol...');

  try {
    // Verificar usuarios existentes antes de migrar
    const totalUsers = await User.countDocuments();
    const usersWithCcmRol = await User.countDocuments({ ccmRol: { $exists: true } });
    
    console.log(`📊 Estado actual:`);
    console.log(`   - Total de usuarios: ${totalUsers}`);
    console.log(`   - Usuarios con ccmRol: ${usersWithCcmRol}`);
    console.log(`   - Usuarios sin ccmRol: ${totalUsers - usersWithCcmRol}`);

    // NO establecer valor por defecto para usuarios existentes
    // Solo verificar que el esquema permite el campo
    console.log('✅ Verificación completada. El campo ccmRol está disponible para uso.');
    console.log('ℹ️  Los usuarios existentes pueden usar ccmRol cuando lo necesiten.');
    console.log('ℹ️  Los nuevos usuarios podrán tener ccmRol asignado.');

    // Verificar que podemos crear un usuario con ccmRol
    const testUser = new User({
      name: 'Usuario Test Migración',
      email: 'test-migration@example.com',
      emailVerified: true,
      provider: 'local',
      role: 'USER',
      ccmRol: 'SUPERVISOR',
      termsAccepted: true
    });

    await testUser.save();
    console.log('✅ Usuario de prueba creado con ccmRol:', testUser.ccmRol);

    // Limpiar usuario de prueba
    await User.deleteOne({ email: 'test-migration@example.com' });
    console.log('🧹 Usuario de prueba eliminado');

  } catch (error) {
    console.error('❌ Error en la migración:', error);
  }

  process.exit(0);
}

migrateUsers();
```

**Ejecutar migración:**
```bash
node config/migrate-add-ccmRol.js
```

### Paso 7: Probar el Nuevo Campo
**Crear script de prueba:** `config/test-ccmRol.js`

```javascript
const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const User = require('~/models/User');
const connect = require('./connect');

async function testCcmRol() {
  await connect();

  console.log('🧪 Probando campo ccmRol (opcional)...');

  try {
    // 1. Crear usuario SIN ccmRol (debe funcionar)
    const userWithoutCcmRol = new User({
      name: 'Usuario Sin CCM',
      email: 'test-sin-ccm@example.com',
      emailVerified: true,
      provider: 'local',
      role: 'USER',
      termsAccepted: true
      // Sin ccmRol - debe ser válido
    });

    await userWithoutCcmRol.save();
    console.log('✅ Usuario creado SIN ccmRol:', userWithoutCcmRol.ccmRol); // undefined

    // 2. Crear usuario CON ccmRol
    const userWithCcmRol = new User({
      name: 'Usuario Con CCM',
      email: 'test-con-ccm@example.com',
      emailVerified: true,
      provider: 'local',
      role: 'USER',
      ccmRol: 'SUPERVISOR',
      termsAccepted: true
    });

    await userWithCcmRol.save();
    console.log('✅ Usuario creado CON ccmRol:', userWithCcmRol.ccmRol);

    // 3. Actualizar usuario existente para añadir ccmRol
    await User.updateOne(
      { email: 'test-sin-ccm@example.com' },
      { $set: { ccmRol: 'MANAGER' } }
    );

    const updatedUser = await User.findOne({ email: 'test-sin-ccm@example.com' });
    console.log('✅ Usuario actualizado con ccmRol:', updatedUser.ccmRol);

    // 4. Verificar que múltiples usuarios pueden tener el mismo ccmRol
    const userWithSameCcmRol = new User({
      name: 'Otro Supervisor',
      email: 'test-otro-supervisor@example.com',
      emailVerified: true,
      provider: 'local',
      role: 'USER',
      ccmRol: 'SUPERVISOR', // Mismo valor que el usuario anterior
      termsAccepted: true
    });

    await userWithSameCcmRol.save();
    console.log('✅ Múltiples usuarios pueden tener el mismo ccmRol');

    // 5. Contar usuarios por ccmRol
    const supervisorCount = await User.countDocuments({ ccmRol: 'SUPERVISOR' });
    console.log(`📊 Usuarios con ccmRol 'SUPERVISOR': ${supervisorCount}`);

    // Limpiar usuarios de prueba
    await User.deleteMany({ 
      email: { 
        $in: [
          'test-sin-ccm@example.com', 
          'test-con-ccm@example.com',
          'test-otro-supervisor@example.com'
        ] 
      } 
    });
    console.log('🧹 Usuarios de prueba eliminados');

  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

testCcmRol();
```

**Ejecutar prueba:**
```bash
node config/test-ccmRol.js
```

### Paso 8: Actualizar Scripts de Usuario (Opcional)
**Modificar `config/create-user.js` para incluir ccmRol:**

```javascript
// Añadir variable
let ccmRol = '';

// En el parseo de argumentos
} else if (!password) {
  console.red('Warning: password passed in as argument, this is not secure!');
  password = process.argv[i];
} else if (!ccmRol) {
  ccmRol = process.argv[i];  // ← AÑADIR
}

// En la creación del usuario
const userData = {
  email,
  name,
  username,
  emailVerified,
  provider: 'local',
  role: 'USER',
  ccmRol: ccmRol || '',  // ← AÑADIR
  termsAccepted: true
};
```

### Paso 9: Verificar en Producción
**Comandos de verificación en MongoDB:**
```javascript
// Acceder a producción
docker exec -it chat-mongodb mongosh LibreChat

// Verificar esquema
db.users.findOne({}, {ccmRol: 1, role: 1, email: 1})

// Estadísticas
db.users.countDocuments({ccmRol: {$exists: true}})
db.users.countDocuments({ccmRol: "SUPERVISOR"})
```

---

## 🔍 Comandos Útiles para Debugging

### Verificar Estado del Contenedor
```bash
# Ver logs del contenedor
docker logs chat-mongodb

# Ver estado de contenedores
docker ps

# Acceder al shell del contenedor
docker exec -it chat-mongodb bash
```

### Inspeccionar Base de Datos
```javascript
// Usar MongoDB shell
docker exec -it chat-mongodb mongosh LibreChat

// Ver todas las colecciones
show collections

// Ver esquema de usuarios (estimado)
db.users.find().limit(1).forEach(doc => {
  for (let key in doc) {
    print(key + ": " + typeof doc[key]);
  }
});
```

### Verificar Cambios en el Código
```bash
# Ver archivos modificados
git status

# Ver diferencias
git diff packages/data-schemas/src/schema/user.ts

# Ver logs de construcción
npm run build:data-schemas
```

---

## ⚠️ Consideraciones Importantes

### 1. **Campo Opcional - No Afectar Usuarios Existentes**
- ✅ El campo `ccmRol` es **opcional** (`required: false`)
- ✅ **NO se establece valor por defecto** para usuarios existentes
- ✅ Los usuarios existentes pueden seguir funcionando sin `ccmRol`
- ✅ Solo los nuevos usuarios o actualizaciones específicas tendrán `ccmRol`

### 2. **Backup de Datos**
```bash
# Crear backup antes de cualquier cambio
docker exec chat-mongodb mongodump --db LibreChat --out /data/backup

# O desde el host
docker run --rm -v librechat-avi_data-node:/data -v $(pwd)/backup:/backup mongo bash -c "mongodump --db LibreChat --out /backup"
```

### 3. **Validaciones Mínimas**
- Solo `maxlength: 50` para limitar longitud
- Sin otras validaciones para mantener flexibilidad
- Los valores pueden repetirse (múltiples usuarios con mismo rol)

### 4. **Migración Segura**
- **NO modificar usuarios existentes** automáticamente
- Verificar que el esquema funciona con usuarios sin `ccmRol`
- Probar creación de usuarios con y sin `ccmRol`

---

## 🎯 Checklist de Verificación

- [ ] **Campo opcional implementado** (`required: false`, sin valor por defecto)
- [ ] Esquema TypeScript modificado con `ccmRol?: string`
- [ ] Campo añadido a esquema Mongoose (sin `default`, sin validaciones extras)
- [ ] Paquete reconstruido (`npm run build:data-schemas`)
- [ ] Aplicación reiniciada sin afectar usuarios existentes
- [ ] Verificado que usuarios sin `ccmRol` siguen funcionando
- [ ] Campo probado con datos de ejemplo (con y sin `ccmRol`)
- [ ] Verificado que múltiples usuarios pueden tener el mismo `ccmRol`
- [ ] Scripts de usuario actualizados (opcional)
- [ ] Backup de datos realizado antes de cambios
- [ ] Documentación actualizada con nuevo campo

### Verificaciones Específicas para Campo Opcional

```javascript
// Verificar que usuarios existentes no se ven afectados
db.users.find({ccmRol: {$exists: false}}).count()  // Debe ser > 0

// Verificar que podemos crear usuarios con ccmRol
db.users.insertOne({email: "test@example.com", ccmRol: "SUPERVISOR"})

// Verificar que podemos crear usuarios sin ccmRol  
db.users.insertOne({email: "test2@example.com"})  // Sin ccmRol

// Verificar que valores pueden repetirse
db.users.find({ccmRol: "SUPERVISOR"}).count()  // Puede ser > 1
```

---

## 📚 Referencias del Proyecto

- **Esquemas:** `packages/data-schemas/src/schema/user.ts`
- **Modelos:** `api/models/User.js`
- **Configuración Docker:** `docker-compose.yml`
- **Scripts de usuario:** `config/*.js`
- **Construcción:** `npm run build:data-schemas`

Esta guía está basada en el análisis completo de la arquitectura de LibreChat-AVI y sigue los patrones establecidos en el proyecto.</content>
<parameter name="filePath">d:\Proyectos\LibreChat-AVI\GUIA_AGREGAR_CAMPO_CCMROL.md