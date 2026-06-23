# 📋 Documentación AVI Roles System - LibreChat

## 🎯 Resumen de la Implementación

Se implementó un sistema completo de **AviRoles** y **AviSubroles** jerárquico para LibreChat, que permite asignar roles específicos AVI a usuarios manteniendo la integridad referencial y facilitando la creación de formularios.

---

## 🏗️ Arquitectura del Sistema

### **Collections MongoDB:**
- **`avirols`** - 3 roles principales: generico, cuidador, administrativo
- **`avisubrols`** - 9 subroles (3 por cada rol principal)
- **`users`** - Extendido con campos `aviRol_id` y `aviSubrol_id`

### **Estructura Jerárquica:**
```
generico
├── Lector
├── Comentarista
└── Colaborador

cuidador
├── Cuidador Principal
├── Cuidador Secundario
└── Asistente

administrativo
├── Gestor de Usuarios
├── Configuración
└── Supervisor
```

---

## 📁 Archivos Implementados

### **🔧 Schemas (packages/data-schemas/src/schema/)**

#### `aviRol.ts`
```typescript
// Schema para roles principales AVI
const aviRolSchema = new Schema<IAviRol>({
  name: {
    type: String,
    required: true,
    unique: true,
    index: true
  }
}, { timestamps: true });
```

#### `aviSubrol.ts`
```typescript
// Schema para subroles con referencia al rol padre
const aviSubrolSchema = new Schema<IAviSubrol>({
  name: {
    type: String,
    required: true,
    index: true
  },
  parentRolId: {
    type: Schema.Types.ObjectId,
    ref: 'AviRol',
    required: true,
    index: true
  }
}, { timestamps: true });
```

#### `user.ts` (Actualizado)
```typescript
// Campos agregados al schema de usuario
aviRol_id: {
  type: Schema.Types.ObjectId,
  ref: 'AviRol',
  required: false,
  index: true,
},
aviSubrol_id: {
  type: Schema.Types.ObjectId,
  ref: 'AviSubrol',
  required: false,
  index: true,
}
```

### **🏷️ Types (packages/data-schemas/src/types/)**

#### `aviRol.ts`
```typescript
export interface IAviRol extends Document {
  name: string;
  createdAt?: Date;
  updatedAt?: Date;
}
```

#### `aviSubrol.ts`
```typescript
export interface IAviSubrol extends Document {
  name: string;
  parentRolId: Types.ObjectId;
  createdAt?: Date;
  updatedAt?: Date;
}
```

#### `user.ts` (Actualizado)
```typescript
export interface IUser extends Document {
  // ... campos existentes
  aviRol_id?: Types.ObjectId;
  aviSubrol_id?: Types.ObjectId;
}
```

### **🔧 Models (packages/data-schemas/src/models/)**

#### `aviRol.ts`
```typescript
export function createAviRolModel(mongoose: typeof import('mongoose')) {
  return mongoose.model<IAviRol>('AviRol', aviRolSchema, 'avirols');
}
```

#### `aviSubrol.ts`
```typescript
export function createAviSubrolModel(mongoose: typeof import('mongoose')) {
  return mongoose.model<IAviSubrol>('AviSubrol', aviSubrolSchema, 'avisubrols');
}
```

---

## ⚙️ Métodos Principales

### **📋 AviRol Methods (packages/data-schemas/src/methods/aviRol.ts)**

| Método | Descripción | Uso para Formularios |
|--------|-------------|----------------------|
| `initializeAviRoles()` | Crea los 3 roles por defecto | Inicialización |
| `listAviRoles()` | Lista todos los roles | **Cargar opciones del select** |
| `getAviRolById(id)` | Obtiene rol por ID | Validación |
| `getAviRolByName(name)` | Obtiene rol por nombre | Búsqueda |
| `createAviRol(data)` | Crea nuevo rol | Administración |
| `updateAviRol(id, updates)` | Actualiza rol | Administración |
| `deleteAviRol(id)` | Elimina rol | Administración |

### **📋 AviSubrol Methods (packages/data-schemas/src/methods/aviSubrol.ts)**

| Método | Descripción | Uso para Formularios |
|--------|-------------|----------------------|
| `initializeAviSubroles()` | Crea los 9 subroles por defecto | Inicialización |
| `listAviSubroles()` | Lista todos los subroles con populate | **Cargar todas las opciones** |
| `getAviSubrolesByParentId(parentId)` | Filtra subroles por rol padre | **Select dinámico filtrado** |
| `getAviSubrolById(id)` | Obtiene subrol por ID | Validación |
| `validateSubrolBelongsToRole(subrolId, rolId)` | Valida jerarquía | Validación de formulario |
| `createAviSubrol(data)` | Crea nuevo subrol | Administración |
| `updateAviSubrol(id, updates)` | Actualiza subrol | Administración |
| `deleteAviSubrol(id)` | Elimina subrol | Administración |

### **👤 User Methods Extendidos (packages/data-schemas/src/methods/user.ts)**

| Método | Descripción | Uso para Formularios |
|--------|-------------|----------------------|
| `assignUserAviRoles(userId, aviRolId, aviSubrolId?)` | Asigna roles con validación | **Guardar formulario** |
| `getUserWithAviRoles(userId)` | Usuario con nombres populados | **Mostrar datos del usuario** |
| `removeUserAviRoles(userId)` | Remueve roles AVI del usuario | Limpiar roles |
| `getUsersByAviRole(aviRolId)` | Usuarios filtrados por rol | Reportes |
| `validateUserAviRoles(userId)` | Valida coherencia de roles | Auditoría |

---

## 🚀 Comandos de Inicialización

### **Inicialización de datos por defecto:**
```javascript
// Crear roles AVI por defecto
node -e "
const { connectDb } = require('./api/lib/db/connectDb');
const { createModels } = require('./packages/data-schemas/src/models');
const mongoose = require('mongoose');

(async () => {
  await connectDb();
  const models = createModels(mongoose);
  const { initializeAviRoles } = require('./packages/data-schemas/src/methods/aviRol').createAviRolMethods(mongoose);
  const { initializeAviSubroles } = require('./packages/data-schemas/src/methods/aviSubrol').createAviSubrolMethods(mongoose);
  
  await initializeAviRoles();
  await initializeAviSubroles();
  console.log('AVI Roles initialized successfully');
  process.exit(0);
})();
"
```

---

## 💾 Comandos MongoDB Útiles

### **Verificar datos:**
```javascript
// Conectar a MongoDB
docker exec -it chat-mongodb mongosh LibreChat

// Ver todas las collections
db.getCollectionNames()

// Ver AviRoles
db.avirols.find()

// Ver AviSubroles con nombres
db.avisubrols.aggregate([
  {
    $lookup: {
      from: "avirols",
      localField: "parentRolId",
      foreignField: "_id", 
      as: "parentRol"
    }
  },
  {
    $project: {
      name: 1,
      parentRolName: { $arrayElemAt: ["$parentRol.name", 0] }
    }
  }
])

// Ver usuarios con roles AVI
db.users.find({
  $or: [
    { aviRol_id: { $exists: true } },
    { aviSubrol_id: { $exists: true } }
  ]
})

// Estadísticas de uso
db.users.aggregate([
  {
    $lookup: {
      from: "avirols",
      localField: "aviRol_id",
      foreignField: "_id",
      as: "aviRol"
    }
  },
  {
    $group: {
      _id: { $arrayElemAt: ["$aviRol.name", 0] },
      count: { $sum: 1 }
    }
  }
])
```

### **Limpiar datos (si necesario):**
```javascript
// Eliminar todos los AviRoles y AviSubroles
db.avirols.deleteMany({})
db.avisubrols.deleteMany({})

// Limpiar roles AVI de usuarios
db.users.updateMany({}, {
  $unset: {
    aviRol_id: 1,
    aviSubrol_id: 1
  }
})
```

---

## 🎨 Ejemplos de Uso en Formularios

### **1. API Endpoint para cargar opciones del select:**
```javascript
// GET /api/avi-roles/options
app.get('/api/avi-roles/options', async (req, res) => {
  try {
    const roles = await listAviRoles();
    const subroles = await listAviSubroles();
    
    res.json({
      roles: roles.map(r => ({ id: r._id, name: r.name })),
      subroles: subroles.map(s => ({
        id: s._id,
        name: s.name,
        parentRolId: s.parentRolId._id,
        parentRolName: s.parentRolId.name
      }))
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### **2. API Endpoint para subroles filtrados:**
```javascript
// GET /api/avi-subroles/:parentRolId
app.get('/api/avi-subroles/:parentRolId', async (req, res) => {
  try {
    const subroles = await getAviSubrolesByParentId(req.params.parentRolId);
    res.json(subroles.map(s => ({ id: s._id, name: s.name })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### **3. HTML del formulario:**
```html
<form id="aviRolesForm">
  <div class="form-group">
    <label for="aviRol">Rol AVI:</label>
    <select id="aviRol" name="aviRol_id" required>
      <option value="">Seleccionar Rol AVI</option>
      <!-- Se carga dinámicamente -->
    </select>
  </div>

  <div class="form-group">
    <label for="aviSubrol">Subrol AVI:</label>
    <select id="aviSubrol" name="aviSubrol_id">
      <option value="">Seleccionar Subrol AVI</option>
      <!-- Se filtra según el rol seleccionado -->
    </select>
  </div>

  <button type="submit">Asignar Roles</button>
</form>

<script>
// Cargar roles al inicializar
fetch('/api/avi-roles/options')
  .then(response => response.json())
  .then(data => {
    const rolSelect = document.getElementById('aviRol');
    data.roles.forEach(role => {
      const option = new Option(role.name, role.id);
      rolSelect.add(option);
    });
  });

// Filtrar subroles cuando cambia el rol
document.getElementById('aviRol').addEventListener('change', function() {
  const parentRolId = this.value;
  const subrolSelect = document.getElementById('aviSubrol');
  
  // Limpiar opciones
  subrolSelect.innerHTML = '<option value="">Seleccionar Subrol AVI</option>';
  
  if (parentRolId) {
    fetch(`/api/avi-subroles/${parentRolId}`)
      .then(response => response.json())
      .then(subroles => {
        subroles.forEach(subrol => {
          const option = new Option(subrol.name, subrol.id);
          subrolSelect.add(option);
        });
      });
  }
});
</script>
```

### **4. API Endpoint para asignar roles:**
```javascript
// PUT /api/users/:userId/avi-roles
app.put('/api/users/:userId/avi-roles', async (req, res) => {
  try {
    const { aviRolId, aviSubrolId } = req.body;
    const user = await assignUserAviRoles(req.params.userId, aviRolId, aviSubrolId);
    res.json({ success: true, user });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### **5. API Endpoint para mostrar usuario con roles:**
```javascript
// GET /api/users/:userId/with-avi-roles
app.get('/api/users/:userId/with-avi-roles', async (req, res) => {
  try {
    const user = await getUserWithAviRoles(req.params.userId);
    res.json({
      ...user,
      aviRolName: user.aviRol_id?.name || null,
      aviSubrolName: user.aviSubrol_id?.name || null
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

---

## 🔧 Comandos de Build y Deploy

### **Compilar cambios:**
```bash
# Compilar data-schemas
npm run build:data-schemas

# Compilar frontend completo (si necesario)
npm run frontend
```

### **Deploy con Docker:**
```bash
# Deploy completo
docker-compose -f deploy-compose.yml up -d --build

# Solo reconstruir API
docker-compose -f deploy-compose.yml up -d --build api

# Ver logs
docker-compose -f deploy-compose.yml logs -f api
```

### **Verificar funcionamiento:**
```bash
# Estado de contenedores
docker-compose -f deploy-compose.yml ps

# Conectar a MongoDB
docker exec -it chat-mongodb mongosh LibreChat

# Ver logs de API
docker logs LibreChat-API -f
```

---

## 📊 Estructura de Datos

### **Ejemplo de usuario con AviRoles asignados:**
```javascript
{
  _id: ObjectId("..."),
  name: "Juan Pérez",
  email: "juan@example.com",
  role: "USER",
  aviRol_id: ObjectId("68db587f0f0d99b659e86872"),     // generico
  aviSubrol_id: ObjectId("68db587f0f0d99b659e8687e"),  // Lector
  createdAt: ISODate("..."),
  updatedAt: ISODate("...")
}
```

### **Con populate (para mostrar nombres):**
```javascript
{
  _id: ObjectId("..."),
  name: "Juan Pérez",
  email: "juan@example.com", 
  role: "USER",
  aviRol_id: {
    _id: ObjectId("68db587f0f0d99b659e86872"),
    name: "generico"
  },
  aviSubrol_id: {
    _id: ObjectId("68db587f0f0d99b659e8687e"),
    name: "Lector"
  }
}
```

---

## ✅ Ventajas de la Implementación

1. **🔗 Integridad Referencial** - ObjectIds aseguran consistencia
2. **🎨 Formularios Dinámicos** - Fácil filtrado de subroles por rol
3. **📈 Escalable** - Fácil agregar nuevos roles/subroles  
4. **🧹 Limpio** - No duplicación de datos
5. **⚡ Eficiente** - Índices optimizados para consultas
6. **🔒 Validado** - Validación automática de jerarquía
7. **📋 Completo** - CRUD completo para administración

---

## 🎯 Próximos Pasos Sugeridos

1. **Crear interfaz de administración** para gestionar roles/subroles
2. **Implementar permisos** basados en AviRoles
3. **Agregar reportes** de usuarios por rol
4. **Crear dashboards** con estadísticas de roles
5. **Implementar auditoría** de cambios de roles

---

**📅 Fecha de implementación:** 30 de Septiembre, 2025  
**🔧 Versión LibreChat:** v0.8.0-rc4  
**👨‍💻 Implementado por:** GitHub Copilot Assistant