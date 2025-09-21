# Guía para Implementar CcmRol en LibreChat-AVI

## Introducción
Esta guía detalla el paso a paso para agregar la nueva colección `CcmRol` y el campo `ccmRol` al esquema de `User`. **Importante**: No confundir con el campo existente `role` (string, default: 'USER'), que maneja roles como USER, ADMIN, etc. `CcmRol` es una colección separada con `nombre` y `descripcion`, y `ccmRol` en `User` es una referencia obligatoria a esta colección.

Esto incluye:
- Crear la colección `CcmRol`.
- Agregar `ccmRol` como referencia en `User` (sin modificar `role`).
- Asignar valor por defecto ('generico') a usuarios existentes y nuevos.
- Ejecutar migración segura.
- Compilar y desplegar.

**Nota**: Usa Mongoose para referencias eficientes. Patrón basado en el proyecto existente.

## Prerrequisitos
- Rama `dev` actualizada.
- Node.js, npm.
- BD MongoDB accesible.
- Backup de BD.
- Entender diferencia: `role` (string para USER/ADMIN) vs `ccmRol` (referencia a colección).

## Paso 1: Crear el Esquema CcmRol
Crea `packages/data-schemas/src/schema/ccmRol.ts`:

```typescript
import { Schema, Document } from 'mongoose';

export interface ICcmRol extends Document {
  nombre: string;
  descripcion?: string;
}

const CcmRol = new Schema<ICcmRol>(
  {
    nombre: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    descripcion: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

export default CcmRol;
```

- **Explicación**: Esquema para colección `CcmRol`. `nombre` único.

## Paso 2: Exportar CcmRol en index.ts
Agrega a `packages/data-schemas/src/index.ts`:

```typescript
export { default as ccmRolSchema } from './schema/ccmRol';
export type { ICcmRol } from './schema/ccmRol';
```

## Paso 3: Actualizar el Esquema User
Edita `packages/data-schemas/src/schema/user.ts`:

1. Importación (ya existe):
   ```typescript
   import { Schema, Document } from 'mongoose';
   ```

2. Interfaz `IUser` (agrega después de `role?: string;`):
   ```typescript
   role?: string;  // Mantener intacto: USER, ADMIN, etc.
   ccmRol: Schema.Types.ObjectId;  // Nuevo: referencia a CcmRol
   ```

3. Esquema `User` (agrega después de `role`):
   ```typescript
   role: {
     type: String,
     default: SystemRoles.USER,  // Mantener intacto
   },
   ccmRol: {
     type: Schema.Types.ObjectId,
     ref: 'CcmRol',
     required: true,
   },
   ```

- **Explicación**: Agrega `ccmRol` como campo nuevo. `role` permanece sin cambios.

## Paso 4: Crear el Modelo CcmRol
Crea `api/models/CcmRol.js`:

```javascript
const mongoose = require('mongoose');
const { ccmRolSchema } = require('@librechat/data-schemas');

const CcmRol = mongoose.model('CcmRol', ccmRolSchema);

module.exports = CcmRol;
```

## Paso 5: Crear el Script de Migración
Crea `config/migrate-ccmRol.js`:

```javascript
const path = require('path');
require('module-alias')({ base: path.resolve(__dirname, '..', 'api') });
const CcmRol = require('~/models/CcmRol');
const User = require('~/models/User');
const connect = require('./connect');

(async () => {
  await connect();
  console.log('Conectado a la BD.');

  // Insertar rol 'generico'
  const genericRol = await CcmRol.findOneAndUpdate(
    { nombre: 'generico' },
    { nombre: 'generico', descripcion: 'Rol genérico por defecto' },
    { upsert: true, new: true }
  );
  console.log(`Rol 'generico' ID: ${genericRol._id}`);

  // Actualizar usuarios sin ccmRol
  const result = await User.updateMany(
    { ccmRol: { $exists: false } },
    { ccmRol: genericRol._id }
  );
  console.log(`Usuarios actualizados: ${result.modifiedCount}`);

  console.log('Migración completada.');
  process.exit(0);
})();
```

## Paso 6: Ejecutar la Migración
```bash
node config/migrate-ccmRol.js
```

- Verifica colección `CcmRol` y usuarios con `ccmRol`.

## Paso 7: Compilar los Cambios
```bash
npm run build:data-schemas
```

## Paso 8: Construir y Desplegar
- Commit a `dev`.
- Workflow construye imagen.
- Despliega con Dokploy.

## Verificación
- Nuevo usuario: Asignar `ccmRol` en registro.
- Queries: `.populate('ccmRol')` para obtener nombre.
- Usuarios existentes: Tienen 'generico'.

## Archivos
- `packages/data-schemas/src/schema/ccmRol.ts` (nuevo)
- `packages/data-schemas/src/index.ts` (modificado)
- `packages/data-schemas/src/schema/user.ts` (modificado)
- `api/models/CcmRol.js` (nuevo)
- `config/migrate-ccmRol.js` (nuevo)

¡Recuerda mantener `role` separado de `ccmRol`!</content>
<parameter name="filePath">d:/Proyectos/LibreChat-AVI/GUIA_IMPLEMENTAR_CCMROL.md