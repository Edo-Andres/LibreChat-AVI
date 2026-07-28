# Sistema AVI Roles - Documentación

## Descripción General

El sistema AVI Roles implementa un sistema jerárquico de roles y subroles para gestionar usuarios de manera más granular. Este sistema **coexiste** con el sistema de roles existente de LibreChat (ADMIN, USER, etc.).

## Estructura de la Base de Datos

### Colecciones

#### 1. `aviRol`
Contiene los 3 roles principales del sistema:
- `generico`
- `cuidador` 
- `administrativo`

**Schema:**
```javascript
{
  _id: ObjectId,
  name: String, // Único e indexado
  createdAt: Date,
  updatedAt: Date
}
```

#### 2. `aviSubrol`
Contiene 9 subroles, 3 por cada rol padre:

**Schema:**
```javascript
{
  _id: ObjectId,
  name: String,
  parentRolId: ObjectId, // Referencia a aviRol
  createdAt: Date,
  updatedAt: Date
}
```

**Subroles por defecto:**
- **generico**: Lector, Comentarista, Colaborador
- **cuidador**: Cuidador Principal, Cuidador Secundario, Asistente  
- **administrativo**: Gestor de Usuarios, Configuración, Supervisor

#### 3. `users` (modificado)
Se agregaron dos campos opcionales:
- `aviRol_id`: ObjectId (referencia a aviRol)
- `aviSubrol_id`: ObjectId (referencia a aviSubrol)

El campo `role` existente se mantiene sin cambios.

## API/Métodos Disponibles

### AviRol Methods

```javascript
// Inicializar roles por defecto
await methods.initializeAviRoles();

// Listar todos los roles
const roles = await methods.listAviRoles();

// Obtener rol por ID
const role = await methods.getAviRolById(roleId);

// Obtener rol por nombre
const role = await methods.getAviRolByName('generico');

// Crear nuevo rol
const newRole = await methods.createAviRol({ name: 'nuevo-rol' });

// Actualizar rol
const updated = await methods.updateAviRol(roleId, { name: 'nuevo-nombre' });

// Eliminar rol (solo si no tiene subroles)
await methods.deleteAviRol(roleId);
```

### AviSubrol Methods

```javascript
// Inicializar subroles por defecto
await methods.initializeAviSubroles();

// Listar todos los subroles
const subroles = await methods.listAviSubroles();

// Obtener subroles por rol padre
const subroles = await methods.getAviSubrolesByParentId(roleId);

// Obtener subrol por ID
const subrol = await methods.getAviSubrolById(subrolId);

// Validar que subrol pertenece a rol
const validation = await methods.validateSubrolBelongsToRole(subrolId, roleId);

// Crear nuevo subrol
const newSubrol = await methods.createAviSubrol({ 
  name: 'nuevo-subrol', 
  parentRolId: roleId 
});

// Actualizar subrol
const updated = await methods.updateAviSubrol(subrolId, { name: 'nuevo-nombre' });

// Eliminar subrol
await methods.deleteAviSubrol(subrolId);
```

### User Methods (AVI Roles)

```javascript
// Asignar rol y subrol a usuario (con validación)
const user = await methods.assignUserAviRoles(userId, roleId, subrolId);

// Obtener usuario con roles poblados
const userWithRoles = await methods.getUserWithAviRoles(userId);

// Remover roles AVI de usuario
const user = await methods.removeUserAviRoles(userId);

// Obtener usuarios por rol
const users = await methods.getUsersByAviRole(roleId);

// Validar consistencia de roles de usuario
const validation = await methods.validateUserAviRoles(userId);
```

## Reglas de Negocio y Validaciones

### 1. Integridad Referencial
- Un subrol DEBE tener un `parentRolId` válido
- Un usuario con `aviSubrol_id` DEBE tener un `aviRol_id` correspondiente
- Un usuario NO puede tener un subrol que no pertenezca a su rol

### 2. Validaciones Automáticas
- Al asignar un subrol a un usuario, se valida que pertenezca al rol del usuario
- Al eliminar un rol, se verifica que no tenga subroles asignados
- Al crear un subrol, se valida que el rol padre exista

### 3. Campos Opcionales
- Los campos `aviRol_id` y `aviSubrol_id` son opcionales para mantener compatibilidad
- Los usuarios existentes pueden seguir funcionando sin AVI roles asignados

## Inicialización del Sistema

El sistema se inicializa automáticamente en el `seedDatabase()`:

```javascript
const seedDatabase = async () => {
  await methods.initializeRoles();
  await methods.seedDefaultRoles();
  await methods.ensureDefaultCategories();
  // Nueva inicialización AVI Roles
  await methods.initializeAviRoles();
  await methods.initializeAviSubroles();
};
```

## Scripts de Utilidad

### Test del Sistema
```bash
node config/test-avi-roles.js
```
Crea datos de prueba y valida el funcionamiento del sistema.

### Migración/Validación
```bash
node config/migrate-avi-roles.js
```
Verifica la integridad de los datos existentes y reporta inconsistencias.

## Ejemplos de Uso

### Asignar Rol "Cuidador" con Subrol "Cuidador Principal"

```javascript
// 1. Obtener el rol cuidador
const cuidadorRole = await methods.getAviRolByName('cuidador');

// 2. Obtener subroles del cuidador
const subroles = await methods.getAviSubrolesByParentId(cuidadorRole._id);
const cuidadorPrincipal = subroles.find(s => s.name === 'Cuidador Principal');

// 3. Asignar al usuario
const updatedUser = await methods.assignUserAviRoles(
  userId, 
  cuidadorRole._id.toString(),
  cuidadorPrincipal._id.toString()
);
```

### Validar Roles de Todos los Usuarios

```javascript
const User = mongoose.models.User;
const allUsers = await User.find({}).lean();

for (const user of allUsers) {
  const validation = await methods.validateUserAviRoles(user._id.toString());
  if (!validation.isValid) {
    console.log(`User ${user.email} has invalid roles: ${validation.error}`);
  }
}
```

## Compatibilidad

- ✅ **Mantiene el sistema de roles existente** (`role` field)
- ✅ **Retrocompatible** con usuarios existentes
- ✅ **No requiere migración obligatoria** de datos existentes
- ✅ **Coexiste** con el sistema de permisos actual

## Índices de Base de Datos

El sistema crea los siguientes índices automáticamente:

```javascript
// aviRol
{ name: 1 } // único

// aviSubrol  
{ name: 1, parentRolId: 1 } // único compuesto
{ parentRolId: 1 } // para queries por rol padre

// users (agregados)
{ aviRol_id: 1 }
{ aviSubrol_id: 1 }
```

Esto garantiza un rendimiento óptimo en las consultas más comunes.