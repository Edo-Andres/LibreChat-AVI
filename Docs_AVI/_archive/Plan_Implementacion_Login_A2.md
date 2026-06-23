# Plan de Implementación: Rediseño de Login (Propuesta A2)

## Objetivo
Actualizar la interfaz de inicio de sesión de LibreChat-AVI para coincidir con el diseño "Propuesta A2" (file: design_mocks\login_propuesta_A2.html ), implementando un diseño de pantalla dividida con un slider informativo y un formulario modernizado.

## Alcance
- Implementación de nuevo layout (Split Screen).
- Creación del componente de Slider dinámico.
- Estilización del formulario de login existente.
- **Exclusiones**:
  - No se implementará el checkbox "Recordarme".
  - No se incluirán botones de Social Login.

## Prerrequisitos
- Las imágenes necesarias deben estar ubicadas en `client/public/assets/img_avi/`.
  - `bg_login.jpg`
  - `slide-1-inteligencia.jpg`
  - `slide-2-adaptativo.jpg`
  - `slide-3-comunidad.jpg`

## Pasos de Implementación

### 1. Gestión de Assets
- Verificar la existencia del directorio `client/public/assets/img_avi/`.
- Asegurar que las imágenes del diseño estén presentes en dicha ruta.

### 2. Nuevo Componente: AuthSlider
- **Archivo**: `client/src/components/Auth/AuthSlider.tsx`
- **Responsabilidad**: Manejar la visualización del carrusel de imágenes y textos informativos en el panel izquierdo.
- **Detalles Técnicos**:
  - Uso de `useState` y `useEffect` para la rotación automática de slides.
  - Transiciones suaves de opacidad y fondo.
  - Textos definidos:
    1. "Tu Asistente Inteligente"
    2. "Aprendizaje Adaptativo"
    3. "Comunidad Global"

### 3. Actualización de Layout: AuthLayout
- **Archivo**: `client/src/components/Auth/AuthLayout.tsx`
- **Cambios**:
  - Reestructurar el contenedor principal para usar `flex` (pantalla dividida).
  - **Panel Izquierdo (Desktop)**: Renderizar `AuthSlider` (ancho 5/12). Oculto en móviles.
  - **Panel Derecho**: Contenedor del formulario (ancho 7/12 en desktop, full en móvil).
  - Eliminar componentes visuales antiguos no requeridos por el nuevo diseño (ej. `BlinkAnimation` si interfiere, o adaptarlo).

### 4. Modernización del Formulario: LoginForm
- **Archivo**: `client/src/components/Auth/LoginForm.tsx`
- **Cambios de Estilo**:
  - Inputs: Cambiar de estilo "floating label" a etiquetas estáticas superiores.
  - Bordes: Aumentar radio a `rounded-xl`.
  - Colores: Ajustar focus rings a `green-500`.
  - Botón: Estilo sólido verde con sombra (`shadow-green-500/30`).
- **Limpieza**:
  - Remover renderizado de botones de Social Login si existen en este componente o en el padre.
  - Asegurar que no haya checkbox de "Recordarme".

### 5. Verificación
- Comprobar responsividad (Mobile vs Desktop).
- Verificar funcionamiento del slider (tiempos y transiciones).
- Validar flujo de login funcional con los nuevos estilos.
