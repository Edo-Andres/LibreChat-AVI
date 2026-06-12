# Reporte del Caso LAGO — Instalación / Acceso Directo de la PWA (AVI)

## 1. Resumen ejecutivo

El caso LAGO documenta el problema de ofrecer al usuario una forma de **instalar o crear un acceso directo** a la PWA **AVI** (LibreChat-AVI, React + Vite) sin que tenga que entrar manualmente al menú del navegador.

**Hallazgo principal:** el popup nativo de instalación no aparecía porque el manifest no cumplía los criterios de instalabilidad de Chrome (faltaba un icono de **512x512 con `purpose: 'any'`**), y porque el evento `beforeinstallprompt` **no puede forzarse desde código**: depende del navegador.

**Conclusión clave:** ningún navegador permite crear un acceso directo en el sistema con un solo clic 100% automático. Lo más cercano posible es el flujo `beforeinstallprompt` (1 clic + 1 confirmación), con un fallback de instrucciones manuales para navegadores que no lo soportan.

---

## 2. Situación detectada

- La app corre en `https://localhost:3090/` (HTTPS local con `vite-plugin-mkcert`).
- El usuario solo podía instalar desde el menú manual de Chrome.
- No aparecía ningún popup automático.
- **Bug raíz:** en `vite.config.ts`, el único icono de 512px tenía `purpose: 'maskable'`. Chrome **no lo cuenta** como icono válido para instalabilidad, por lo que nunca emitía `beforeinstallprompt`.

---

## 3. Restricción fundamental del navegador

```
┌─────────────────────────────────────────────┐
│           SANDBOX DEL NAVEGADOR             │
│   JavaScript NO puede:                      │
│   ❌ Escribir en el escritorio              │
│   ❌ Modificar el menú de inicio            │
│   ❌ Crear accesos directos automáticamente │
│   🔒 Bloqueado por seguridad                │
└─────────────────────────────────────────────┘
```

No existe una API que cree un acceso directo con un clic automático. Es una restricción de seguridad de todos los SO y navegadores.

---

## 4. Soluciones evaluadas

### Solución 1 — Instalación PWA nativa (`beforeinstallprompt`)

Corregir el manifest y capturar el evento del navegador. Al hacer clic en el botón, Chrome muestra **su propio popup** ("¿Instalar AVI?"), que es literalmente el diálogo de creación de acceso directo.

| Ventajas | Desventajas |
|---|---|
| Experiencia de app real (modo `standalone`) | Solo Chrome/Edge (Chromium) |
| Instalación en 2 clics (botón + confirmar) | Safari iOS y Firefox no emiten el evento |
| Nombre e icono "AVI" controlados | Depende de heurísticas de Chrome (engagement, manifest, SW) |
| Funciona offline (Service Worker) | Requiere mantener SW, iconos exactos y HTTPS |
| Aparece en lista de apps del SO | Más difícil de depurar |

### Solución 2 — Botón universal "Crear acceso directo" (guía por plataforma)

Modal propio que detecta la plataforma (iOS / Android / escritorio) y muestra instrucciones paso a paso.

| Ventajas | Desventajas |
|---|---|
| Universal: iOS, Android, Windows, macOS, Linux | No es automático (2-4 pasos manuales) |
| 100% predecible, sin depender del navegador | Puede abrir como pestaña, no como app |
| Simple: solo React, sin SW ni HTTPS obligatorio | Instrucciones pueden quedar desactualizadas |
| Fácil de mantener | No garantiza modo standalone ni offline |

### Workaround descartado — Archivo `.url` / `.webloc`

Generar y descargar un archivo de acceso directo. **Descartado** porque: se descarga a la carpeta Descargas (no al escritorio), el usuario debe moverlo manualmente, no funciona en móviles y abre como pestaña normal.

---

## 5. Solución recomendada: enfoque híbrido

```
Usuario pincha "Crear acceso directo"
        ↓
¿Chrome tiene el evento beforeinstallprompt disponible?
   ├── SÍ → Popup nativo de Chrome → 1 clic y listo ✅
   └── NO → Modal con instrucciones paso a paso 📋
```

### 5.1 Corrección del manifest (`vite.config.ts`)

```typescript
manifest: {
  id: '/',
  name: 'AVI',
  short_name: 'AVI',
  description: 'Asistente Virtual en Infancia',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#000000',
  theme_color: '#009688',
  icons: [
    { src: 'assets/favicon-16x16.png', sizes: '16x16', type: 'image/png' },
    { src: 'assets/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
    { src: 'assets/icon-192x192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: 'assets/icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },     // ← OBLIGATORIO
    { src: 'assets/maskable-icon.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
  ],
}
```

### 5.2 Componente híbrido (`InstallPWAButton.tsx`)

```tsx
import { useState, useEffect } from 'react';

export default function InstallPWAButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showManualGuide, setShowManualGuide] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleClick = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') console.log('Acceso directo creado');
      setDeferredPrompt(null);
    } else {
      setShowManualGuide(true);
    }
  };

  return (
    <>
      <button onClick={handleClick}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-teal-600 text-white px-5 py-3 shadow-lg">
        📱 Crear acceso directo
      </button>

      {showManualGuide && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md">
            <h3 className="text-lg font-bold mb-3">Crear acceso directo a AVI</h3>
            <p className="text-sm mb-2">Tu navegador no permite hacerlo automáticamente. Sigue estos pasos:</p>
            <ol className="text-sm space-y-2 list-decimal ml-4">
              <li>Haz clic en los 3 puntos ⋮ del navegador</li>
              <li>Selecciona <b>Guardar y compartir</b></li>
              <li>Elige <b>Crear acceso directo</b></li>
              <li>Marca "Abrir como ventana" y confirma</li>
            </ol>
            <button onClick={() => setShowManualGuide(false)}
              className="mt-4 w-full py-2 bg-gray-200 rounded-xl">Entendido</button>
          </div>
        </div>
      )}
    </>
  );
}
```

---

## 6. Cómo lo resuelven las grandes empresas

Empresas como **Twitter/X, Pinterest, Starbucks y Spotify** usan el patrón **"Custom In-App Install Promotion"**, en capas:

### Capa 1 — UX estándar
- **Banner contextual**, nunca al cargar la página. Se muestra en "momentos de valor" (ej: tras la primera conversación en AVI).
- **Frequency capping**: si el usuario lo cierra, no se vuelve a mostrar por X días (localStorage).
- **Detección de "ya instalada"**: `window.matchMedia('(display-mode: standalone)')` y `navigator.standalone` (iOS).

```typescript
const isAlreadyInstalled =
  window.matchMedia('(display-mode: standalone)').matches ||
  (navigator as any).standalone === true;
```

### Capa 2 — Medición del funnel
```typescript
window.addEventListener('beforeinstallprompt', () => analytics.track('pwa_installable'));
// tras userChoice:
analytics.track('pwa_prompt_result', { outcome });
window.addEventListener('appinstalled', () => analytics.track('pwa_installed'));
```
Permite A/B testing del momento y diseño del banner.

### Capa 3 — Librerías mantenidas (no reinventar la rueda)
| Herramienta | Qué hace |
|---|---|
| `pwa-install` (web component) | Banner multiplataforma con instrucciones iOS incluidas |
| `react-pwa-install` | Hook React que abstrae `beforeinstallprompt` + fallback iOS |
| `vite-plugin-pwa` + Workbox | Estándar de facto (ya en uso en LAGO) |

### Capa 4 — Tiendas de aplicaciones (máxima escala, cero fricción)
```
                    ┌→ Google Play     (vía TWA - Trusted Web Activity)
Tu PWA (la misma) ──┼→ Microsoft Store (vía PWABuilder)
                    └→ App Store iOS   (vía PWABuilder, con limitaciones)
```
- **PWABuilder** (gratuito, de Microsoft): genera los paquetes para tiendas desde tu URL.
- **TWA**: la PWA corre dentro de un APK real → el usuario instala desde Google Play con **un clic, sin tutoriales**.

---

## 7. Plan de acción para LAGO

| Plazo | Acción |
|---|---|
| **Corto** | Corregir manifest (icono 512 `any`) + componente híbrido con frequency capping y detección de "ya instalada" |
| **Mediano** | Agregar tracking de eventos de instalación (installable / accepted / installed) |
| **Largo** | Si AVI se distribuye a familias/instituciones: empaquetar con **PWABuilder + TWA** y publicar en Google Play para lograr instalación real de "un clic" |

---

## 8. Verificación y control de calidad

1. Reiniciar Vite por completo (el manifest se cachea).
2. DevTools → `Application` → `Service Workers` → **Unregister** + `Clear site data`.
3. DevTools → `Application` → `Manifest`: sin errores rojos y botón "Install" activo.
4. Probar el evento en consola:
   ```javascript
   window.addEventListener('beforeinstallprompt', e => console.log('🎉 instalable', e));
   ```
5. Forzar pruebas: `chrome://flags/#bypass-app-banner-engagement-checks` → **Enabled**.
6. Auditar con **Lighthouse** (DevTools → Lighthouse → categoría PWA) antes de cada release.

---

## 9. Conclusiones

- El bug raíz del caso LAGO **no era una limitación del navegador**, sino un **manifest mal configurado** (faltaba icono 512px `any`), que impedía que Chrome emitiera `beforeinstallprompt`.
- La creación de acceso directo "100% automática de un clic" **no existe** en la web por seguridad. Lo más cercano es el popup nativo de Chrome (2 clics).
- La **solución profesional** es el enfoque **híbrido**: prompt nativo cuando está disponible + instrucciones por plataforma cuando no, con banner contextual, frequency capping, detección de instalación y analítica.
- Para distribución masiva sin fricción, las empresas **empaquetan la PWA y la publican en tiendas** (PWABuilder / TWA).

---

**Estado del caso:** Resuelto a nivel de proyecto. La aparición del diálogo nativo es propia del navegador y se mitiga con el enfoque híbrido + (opcionalmente) publicación en tiendas.