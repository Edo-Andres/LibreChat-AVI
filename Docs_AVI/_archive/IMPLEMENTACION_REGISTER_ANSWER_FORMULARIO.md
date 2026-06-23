# 📋 Implementación: Mostrar `registerAnswer` en Formulario de Registro

**Fecha**: 28 de Octubre, 2025  
**Branch**: `dev_registerAnswer`  
**Objetivo**: Modificar el formulario de registro para mostrar el campo `registerAnswer` en lugar de `name` en los selects de Rol y Subrol AVI.

---

## 🎯 Resumen Ejecutivo

### Cambios Solicitados

| Elemento | Estado Actual | Estado Deseado |
|----------|---------------|----------------|
| **Select Rol - Label** | "Rol AVI (Opcional)" | "Rol AVI (Opcional)" |
| **Select Rol - Option text** | `role.name` | `role.registerAnswer` \|\| `role.name` |
| **Select Rol - Placeholder** | "Seleccionar Rol AVI" | "Pregunta 1" |
| **Select Subrol - Label** | "Subrol AVI (Opcional)" | "Subrol AVI (Opcional)" |
| **Select Subrol - Option text** | `subrol.name` | `subrol.registerAnswer` \|\| `subrol.name` |
| **Select Subrol - Placeholder** | "Seleccionar Subrol AVI" | "Pregunta 2" |

### Ejemplo Visual

**Antes:**
```
┌─────────────────────────────────┐
│ Rol AVI (Opcional)              │
├─────────────────────────────────┤
│ Seleccionar Rol AVI       ▼     │
│ Roles_AVI                       │
│ Humorista                       │
│ Admin                           │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Subrol AVI (Opcional)           │
├─────────────────────────────────┤
│ Seleccionar Subrol AVI    ▼     │
│ Programador                     │
│ Configuración                   │
│ Supervisor                      │
└─────────────────────────────────┘
```

**Después:**
```
┌─────────────────────────────────┐
│ Rol AVI (Opcional)              │
├─────────────────────────────────┤
│ Pregunta 1               ▼     │
│ Respuesta formulario registro   │
│ Rol AVI                         │
│ Respuesta formulario registro   │
│ Rol humorista                   │
│ Respuesta formulario registro   │
│ Rol admin                       │
└─────────────────────────────────┘

┌─────────────────────────────────┐
│ Subrol AVI (Opcional)           │
├─────────────────────────────────┤
│ Pregunta 2               ▼     │
│ Respuesta formulario registro   │
│ SubRol programador              │
│ Respuesta formulario registro   │
│ SubRol configuración            │
│ Respuesta formulario registro   │
│ SubRol supervisor               │
└─────────────────────────────────┘
```

---

## 📊 Arquitectura de la Solución

### Flujo de Datos

```
librechat.yaml
    ↓ (roles con registerAnswer)
MongoDB (avirols, avisubrols)
    ↓ (campo registerAnswer presente)
API /api/avi-roles
    ↓ (devuelve todos los campos)
React Query (useAviRolesQuery, useAviSubrolesQuery)
    ↓ (datos disponibles en frontend)
Registration.tsx
    ↓ (renderiza registerAnswer || name)
Usuario ve el formulario con textos personalizados
```

---

## 🔧 Cambios Técnicos

### **Archivo a Modificar**

- ✅ `client/src/components/Auth/Registration.tsx`

**No se requieren cambios en backend** porque:
1. ✅ Los schemas ya tienen el campo `registerAnswer` (implementado previamente)
2. ✅ Los métodos `listAviRoles()` y `getAviSubrolesByParentId()` ya devuelven todos los campos con `.lean()`
3. ✅ Las rutas API ya están funcionando correctamente

---

## 📝 Implementación Detallada

### **Cambio 1: Select de Rol (Rol AVI; placeholder 'Pregunta 1')**

**Archivo**: `client/src/components/Auth/Registration.tsx`  
**Líneas**: 236-251

#### **Código Actual:**
```tsx
<div className="mb-4">
  <div className="relative">
    <select
      id="aviRol_id"
      {...register('aviRol_id')}
      className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
    >
      <option value="">{localize('Seleccionar Rol AVI')}</option>
      {aviRoles.map((role) => (
        <option key={role._id} value={role._id}>
          {role.name}
        </option>
      ))}
    </select>
    <label
      htmlFor="aviRol_id"
      className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500"
    >
      Rol AVI (Opcional)
    </label>
  </div>
</div>
```

#### **Código Nuevo:**
```tsx
<div className="mb-4">
  <div className="relative">
    <select
      id="aviRol_id"
      {...register('aviRol_id')}
      className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
    >
      <option value="">Pregunta 1</option>
      {aviRoles.map((role) => (
        <option key={role._id} value={role._id}>
          {role.registerAnswer || role.name}
        </option>
      ))}
    </select>
    <label
      htmlFor="aviRol_id"
      className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500"
    >
      Rol AVI (Opcional)
    </label>
  </div>
</div>
```

#### **Resumen de Cambios:**
1. **Línea 240**: `{localize('Seleccionar Rol AVI')}` → `Pregunta 1` (placeholder)
2. **Línea 243**: `{role.name}` → `{role.registerAnswer || role.name}`
3. **Línea 249**: `Rol AVI (Opcional)` → (sin cambio; mantener label)

---

### **Cambio 2: Select de Subrol (Subrol AVI; placeholder 'Pregunta 2')**

**Archivo**: `client/src/components/Auth/Registration.tsx`  
**Líneas**: 256-275

#### **Código Actual:**
```tsx
{selectedAviRol && aviSubroles.length > 0 && (
  <div className="mb-4">
    <div className="relative">
      <select
        id="aviSubrol_id"
        {...register('aviSubrol_id')}
        className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
      >
        <option value="">{localize('Seleccionar Subrol AVI')}</option>
        {aviSubroles.map((subrol) => (
          <option key={subrol._id} value={subrol._id}>
            {subrol.name}
          </option>
        ))}
      </select>
      <label
        htmlFor="aviSubrol_id"
        className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500"
      >
        Subrol AVI (Opcional)
      </label>
    </div>
  </div>
)}
```

#### **Código Nuevo:**
```tsx
{selectedAviRol && aviSubroles.length > 0 && (
  <div className="mb-4">
    <div className="relative">
      <select
        id="aviSubrol_id"
        {...register('aviSubrol_id')}
        className="webkit-dark-styles transition-color peer w-full rounded-2xl border border-border-light bg-surface-primary px-3.5 pb-2.5 pt-3 text-text-primary duration-200 focus:border-green-500 focus:outline-none"
      >
        <option value="">Pregunta 2</option>
        {aviSubroles.map((subrol) => (
          <option key={subrol._id} value={subrol._id}>
            {subrol.registerAnswer || subrol.name}
          </option>
        ))}
      </select>
      <label
        htmlFor="aviSubrol_id"
        className="absolute start-3 top-1.5 z-10 origin-[0] -translate-y-4 scale-75 transform bg-surface-primary px-2 text-sm text-text-secondary-alt duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:-translate-y-1/2 peer-placeholder-shown:scale-100 peer-focus:top-1.5 peer-focus:-translate-y-4 peer-focus:scale-75 peer-focus:px-2 peer-focus:text-green-500"
      >
        Subrol AVI (Opcional)
      </label>
    </div>
  </div>
)}
```

#### **Resumen de Cambios:**
1. **Línea 264**: `{localize('Seleccionar Subrol AVI')}` → `Pregunta 2` (placeholder)
2. **Línea 267**: `{subrol.name}` → `{subrol.registerAnswer || subrol.name}`
3. **Línea 273**: `Subrol AVI (Opcional)` → (sin cambio; mantener label)

---

## 🔍 Lógica de Fallback

### **Operador OR (`||`) en JavaScript**

```javascript
{role.registerAnswer || role.name}
```

**Comportamiento:**
- Si `registerAnswer` tiene valor → **Muestra `registerAnswer`**
- Si `registerAnswer` es `null`, `undefined`, o `""` → **Muestra `name`**

### **Ejemplos con Datos Reales**

**Ejemplo 1: Rol con registerAnswer definido**
```javascript
{
  _id: "6734abc789...",
  name: "Admin",
  registerAnswer: "Respuesta formulario registro Rol admin"
}
```
**Renderiza:** `"Respuesta formulario registro Rol admin"` ✅

**Ejemplo 2: Rol sin registerAnswer (fallback)**
```javascript
{
  _id: "6734abc456...",
  name: "Humorista",
  registerAnswer: null
}
```
**Renderiza:** `"Humorista"` ✅

**Ejemplo 3: Rol con registerAnswer vacío (fallback)**
```javascript
{
  _id: "6734abc123...",
  name: "Roles_AVI",
  registerAnswer: ""
}
```
**Renderiza:** `"Roles_AVI"` ✅

---

## 📚 Referencia de Datos del YAML

### **Configuración Actual en `librechat.yaml`**

```yaml
aviRoles:
  roles:
    - name: Roles_AVI
      registerAnswer: "Respuesta formulario registro Rol AVI"
      subroles:
        - name: Cuidador
          registerAnswer: "Respuesta formulario registro SubRol cuidador"
        - name: Psicólogo
          registerAnswer: "Respuesta formulario registro SubRol psicólogo"
    
    - name: Humorista
      registerAnswer: "Respuesta formulario registro Rol humorista"
      subroles:
        - name: Payaso
          registerAnswer: "Respuesta formulario registro SubRol payaso"
        - name: Comediante
          registerAnswer: "Respuesta formulario registro SubRol comediante"
    
    - name: Admin
      registerAnswer: "Respuesta formulario registro Rol admin"
      subroles:
        - name: Programador
          registerAnswer: "Respuesta formulario registro SubRol programador"
        - name: Configuración
          registerAnswer: "Respuesta formulario registro SubRol configuración"
        - name: Supervisor
          registerAnswer: "Respuesta formulario registro SubRol supervisor"
```

### **Resultado Esperado en el Formulario**

**Select (placeholder 'Pregunta 1'):**
- Respuesta formulario registro Rol AVI
- Respuesta formulario registro Rol humorista
- Respuesta formulario registro Rol admin

**Select (placeholder 'Pregunta 2')** (si selecciona "Admin"):
- Respuesta formulario registro SubRol programador
- Respuesta formulario registro SubRol configuración
- Respuesta formulario registro SubRol supervisor

---

## 🧪 Plan de Pruebas

### **Casos de Prueba**

| # | Caso | Precondición | Acción | Resultado Esperado |
|---|------|--------------|--------|-------------------|
| 1 | Cargar formulario | Usuario en `/register` | Abrir página | Select (placeholder 'Pregunta 1') muestra 3 opciones con registerAnswer |
| 2 | Seleccionar Rol | Roles cargados | Clic en select (placeholder 'Pregunta 1') → Seleccionar "Respuesta formulario registro Rol admin" | Select (placeholder 'Pregunta 2') aparece con 3 subroles |
| 3 | Mostrar registerAnswer | Rol/Subrol con registerAnswer definido | Observar opciones del select | Textos muestran registerAnswer completo |
| 4 | Fallback a name | Rol/Subrol sin registerAnswer | Observar opciones del select | Textos muestran name |
| 5 | Registrar usuario | Formulario completo | Llenar todos los campos y enviar | Usuario se crea con aviRol_id y aviSubrol_id correctos en BD |
| 6 | Validar IDs guardados | Usuario registrado | Consultar MongoDB | `aviRol_id` y `aviSubrol_id` son ObjectIds válidos |

---

## 🚀 Pasos de Implementación

### **Paso 1: Aplicar Cambios en el Código**

```bash
# Editar el archivo
code client/src/components/Auth/Registration.tsx

# Aplicar los 2 cambios descritos arriba
# - Cambio 1: Líneas 236-251 (Select Rol)
# - Cambio 2: Líneas 256-275 (Select Subrol)
```

### **Paso 2: Compilar Frontend**

```powershell
# Opción A: Compilar solo el frontend (más rápido)
cd client
npm run build
cd ..

# Opción B: Reiniciar en modo desarrollo
npm run frontend:dev
```

### **Paso 3: Verificar en el Navegador**

1. Abrir `http://localhost:3080/register`
2. Verificar que:
  - Label dice "Rol AVI (Opcional)" y "Subrol AVI (Opcional)"
  - Placeholder dice "Pregunta 1" y "Pregunta 2"
   - Opciones muestran los textos de `registerAnswer`
3. Seleccionar opciones y registrar un usuario de prueba
4. Verificar en MongoDB que se guardaron los IDs correctamente

### **Paso 4: Desplegar a Producción** (Opcional)

```bash
# Reconstruir imagen Docker
docker-compose -f deploy-compose.yml build api

# Reiniciar contenedor
docker-compose -f deploy-compose.yml up -d api
```

---

## ✅ Checklist de Implementación

### **Pre-implementación**
- [x] Verificar que backend ya tiene campo `registerAnswer` en schemas
- [x] Confirmar que API devuelve el campo `registerAnswer`
- [x] Localizar archivo exacto del formulario de registro

### **Durante implementación**
- [ ] Modificar líneas 240, 243, 249 (Select Rol)
- [ ] Modificar líneas 264, 267, 273 (Select Subrol)
- [ ] Compilar frontend (`npm run build` en `client/`)

### **Post-implementación**
- [ ] Probar caso 1: Rol con registerAnswer definido
- [ ] Probar caso 2: Rol sin registerAnswer (fallback)
- [ ] Probar caso 3: Registro completo de usuario
- [ ] Validar en MongoDB que IDs se guardan correctamente
- [ ] Desplegar a producción (si aplica)

---

## ⚠️ Notas Importantes

### **1. Sin Dependencias de Traducción**
Para simplificar, **no usamos** `localize()` en los placeholders. Usamos strings hardcodeados:
```tsx
<option value="">Pregunta 1</option>
```

Si en el futuro quieres agregar traducciones:
```tsx
<option value="">{localize('com_auth_select_option')}</option>
```

### **2. Retrocompatibilidad**
El operador `||` garantiza que si algún rol/subrol no tiene `registerAnswer`, se muestra el `name`. Esto evita errores si:
- Hay roles antiguos sin el campo
- El campo es `null` por error de migración
- Se agregan roles manualmente sin `registerAnswer`

### **3. IDs se Mantienen Igual**
El `value` del `<option>` **siempre es el `_id`**, solo cambia el texto visible:
```tsx
<option key={role._id} value={role._id}>
  {role.registerAnswer || role.name}
</option>
```

Esto garantiza que la funcionalidad de guardado en BD no cambia.

---

## 📊 Comparación Antes/Después

### **Código HTML Generado**

#### **Antes:**
```html
<select id="aviRol_id">
  <option value="">Seleccionar Rol AVI</option>
  <option value="6734abc789...">Admin</option>
  <option value="6734abc456...">Humorista</option>
  <option value="6734abc123...">Roles_AVI</option>
</select>
<label for="aviRol_id">Rol AVI (Opcional)</label>
```

#### **Después:**
```html
<select id="aviRol_id">
  <option value="">Pregunta 1</option>
  <option value="6734abc789...">Respuesta formulario registro Rol admin</option>
  <option value="6734abc456...">Respuesta formulario registro Rol humorista</option>
  <option value="6734abc123...">Respuesta formulario registro Rol AVI</option>
</select>
<label for="aviRol_id">Rol AVI (Opcional)</label>
```

---

## 🔗 Referencias

- **Documento base**: `IMPLEMENTACION_REGISTER_ANSWER.md` - Implementación del campo `registerAnswer`
- **Configuración**: `librechat.yaml` - Definición de roles con `registerAnswer`
- **Schema**: `packages/data-schemas/src/schema/aviRol.ts` y `aviSubrol.ts`
- **Componente**: `client/src/components/Auth/Registration.tsx`
- **API Routes**: `api/server/routes/aviRoles.js`

---

**Fecha de Creación**: 28 de Octubre, 2025  
**Versión del Documento**: 1.0.0  
**Branch de Trabajo**: `dev_registerAnswer`
