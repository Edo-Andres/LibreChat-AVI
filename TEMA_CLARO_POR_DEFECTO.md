# Configuración del Tema Claro por Defecto

## Ubicación Principal

El tema claro está definido como predeterminado en el archivo:

**`client/src/utils/theme.ts`** - Línea 38

```typescript
export const getInitialTheme = () => {
  if (typeof window !== 'undefined' && window.localStorage) {
    const storedPrefs = window.localStorage.getItem('color-theme');
    if (typeof storedPrefs === 'string') {
      return storedPrefs;
    }

    // Comentamos la detección del sistema para forzar tema claro
    // const userMedia = window.matchMedia('(prefers-color-scheme: dark)');
    // if (userMedia.matches) {
    //   return 'dark';
    // }
  }

  return 'light'; // light theme as the default;
};
```

## Cómo Funciona

1. **Prioridad de Configuración:**
   - Primero verifica si hay una preferencia guardada en `localStorage` con la clave `'color-theme'`
   - Si existe una preferencia guardada, la usa
   - Si NO existe preferencia guardada, retorna `'light'` como valor predeterminado

2. **Detección del Sistema (Deshabilitada):**
   - Las líneas 31-35 están comentadas intencionalmente
   - Estas líneas detectarían la preferencia del sistema operativo (modo oscuro/claro)
   - Al estar comentadas, se fuerza el uso del tema claro por defecto

## Archivos Relacionados

### 1. `client/src/hooks/ThemeContext.tsx`
Este archivo usa la función `getInitialTheme()` para:
- Establecer el valor inicial del tema en el contexto de React (línea 14 y 30)
- Proporcionar el tema a toda la aplicación mediante el `ThemeContext`

```typescript
const defaultContextValue: ProviderValue = {
  theme: getInitialTheme(),  // Usa la función que retorna 'light' por defecto
  setTheme: () => {
    return;
  },
};

export const ThemeProvider = ({ initialTheme, children }) => {
  const [theme, setTheme] = useState(getInitialTheme);  // Estado inicial
  // ...
};
```

### 2. `client/src/components/ui/ThemeSelector.tsx`
Este componente permite al usuario cambiar el tema manualmente entre:
- `light` (claro)
- `dark` (oscuro)
- `system` (sistema - aunque se convierte automáticamente a light o dark)

## Para Cambiar el Tema Predeterminado

Si deseas cambiar el tema predeterminado de claro a oscuro, solo necesitas modificar **una línea**:

En `client/src/utils/theme.ts`, línea 38, cambia:
```typescript
return 'light'; // light theme as the default;
```

A:
```typescript
return 'dark'; // dark theme as the default;
```

## Almacenamiento de Preferencias

Una vez que el usuario selecciona un tema, este se guarda en:
- **localStorage** con la clave `'color-theme'`
- Esta preferencia persiste entre sesiones del navegador
- El valor guardado tiene prioridad sobre el valor predeterminado

## Resumen

**Respuesta directa:** El tema claro está definido por defecto en la línea 38 del archivo `client/src/utils/theme.ts`, donde la función `getInitialTheme()` retorna `'light'` cuando no hay ninguna preferencia guardada en localStorage.
