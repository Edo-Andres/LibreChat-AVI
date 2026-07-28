
# Reporte Técnico: Caso AVI
## PWA Install Prompt — Aplicación AVI (LibreChat)

---

## 1. Contexto del caso

**Aplicación:** AVI (LibreChat-AVI)  
**Entorno:** `http://localhost:3090` / `https://localhost:3090`  
**Stack:** React + Vite + vite-plugin-pwa  
**Objetivo:** Que el usuario pueda crear un acceso directo o instalar AVI desde la web, sin tener que navegar manualmente por el menú del navegador.

---

## 2. Situación inicial

- La app corría en `http://localhost:3090`.
- La única forma de instalar era desde el menú manual de Chrome:  
  *"Guardar y compartir → Instalar página como app"*.
- No aparecía ningún popup automático de instalación.
- El evento `beforeinstallprompt` nunca llegaba al componente React.
- El nombre mostrado en Chrome era "LibreChat" en vez de "AVI".

---

## 3. Causa raíz identificada

Revisado el archivo `client/vite.config.ts`, se encontraron los siguientes problemas:

### 3.1 Icono 512x512 declarado solo como `maskable` (crítico)

```ts
// ❌ Configuración incorrecta
{
  src: 'assets/maskable-icon.png',
  sizes: '512x512',
  type: 'image/png',
  purpose: 'maskable', // ← Chrome necesita también uno con purpose: 'any'
}
```

Chrome requiere obligatoriamente:
- Un icono **192x192** con `purpose: "any"`.
- Un icono **512x512** con `purpose: "any"`.
- El icono `maskable` es adicional, no reemplaza al `any`.

### 3.2 `start_url` y `scope` no declarados explícitamente

Con `base: ''` en Vite, el `start_url` puede quedar vacío o mal resuelto.

### 3.3 `mkcert` innecesario para desarrollo local

`http://localhost` ya es considerado origen seguro por Chrome.  
`mkcert` solo es necesario para probar desde otro dispositivo en la red.

---

## 4. Las dos soluciones evaluadas

### Solución A — Optimización de PWA Nativa

Corregir el manifest y el service worker para que Chrome dispare
`beforeinstallprompt` y el componente `InstallPWAButton` pueda
usar el flujo de instalación real del navegador.

**Cambios necesarios:**

```ts
// ✅ Configuración corregida en vite.config.ts
manifest: {
  name: 'AVI',
  short_name: 'AVI',
  start_url: '/',
  scope: '/',
  display: 'standalone',
  background_color: '#000000',
  theme_color: '#009688',
  icons: [
    {
      src: 'assets/icon-192x192.png',
      sizes: '192x192',
      type: 'image/png',
      purpose: 'any',
    },
    {
      src: 'assets/icon-512x512.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'any',        // ← clave: existir como 'any'
    },
    {
      src: 'assets/maskable-icon.png',
      sizes: '512x512',
      type: 'image/png',
      purpose: 'maskable',   // ← complementario
    },
  ],
}
```

| Ventajas | Desventajas |
|:---|:---|
| App independiente (modo `standalone`) | El navegador decide cuándo disparar el evento |
| Aparece en el menú de apps del SO | Requiere iconos, SW y manifest perfectos |
| Experiencia de app nativa real | iOS/Safari: el evento nativo no existe |

---

### Solución B — Guía Universal de Acceso Directo

Un botón "Crear acceso directo" que, al hacer clic, muestra
un modal con instrucciones paso a paso según el SO y navegador
detectado del usuario.

```
¿Existe beforeinstallprompt?
├── SÍ  → Lanzar prompt() nativo del navegador
└── NO  → Mostrar modal con instrucciones según plataforma
          ├── iOS Safari   → Compartir → Añadir a pantalla de inicio
          ├── Android      → Menú ⋮ → Instalar app
          └── Desktop      → Menú ⋮ → Crear acceso directo
```

| Ventajas | Desventajas |
|:---|:---|
| Funciona en todos los SO y navegadores | El usuario debe seguir pasos manuales |
| Única solución válida para iOS | Menos "automático" que la PWA nativa |
| No depende del manifest ni del SW | Las instrucciones varían por navegador |
| Fácil de mantener | |

---

### Comparativa

| Característica | Solución A (PWA) | Solución B (Guía) |
|:---|:---|:---|
| Funciona en iOS Safari | ❌ No | ✅ Sí |
| Funciona en Chrome/Edge Desktop | ✅ Sí | ✅ Sí |
| Funciona en Android Chrome | ✅ Sí | ✅ Sí |
| Requiere manifest perfecto | ✅ Sí | ❌ No |
| Crea acceso con 1 clic | ⚠️ 2 pasos (tu botón + diálogo del browser) | ❌ 3-4 pasos manuales |
| Modo standalone (sin barra) | ✅ Sí | ❌ No siempre |

---

## 5. Límite técnico real (importante)

> **No es posible** crear un acceso directo del sistema con un solo clic
> desde una aplicación web normal. La API de bookmarks/shortcuts del SO
> solo está disponible para extensiones del navegador, no para sitios web.

Lo máximo que puede hacer una web es:
1. Usar `beforeinstallprompt` para disparar el diálogo del navegador (Chrome/Edge).
2. Mostrar instrucciones manuales para el resto de navegadores y SO.

---

## 6. Cómo lo resuelven las grandes empresas

La industria ha convergido en un patrón conocido como
**"Smart App Banner + Install Prompt Híbrido"**.

### Casos reales

| Empresa | Estrategia |
|:---|:---|
| **Twitter / X** | Banner card discreto en la parte inferior, aparece tras varias navegaciones |
| **Pinterest** | Barra superior delgada estilo Smart App Banner |
| **Starbucks** | Botón persistente en el menú lateral |
| **Spotify Web** | Invitación contextual tras escuchar 3 canciones |
| **Telegram Web** | Modal con beneficios mostrado después del login |

### Las 3 capas del patrón profesional

**Capa 1 — Timing inteligente (no al primer segundo)**
- Mostrar el banner solo después de que el usuario demuestre interés:
  - Haber navegado 2-3 páginas, **o**
  - Haber pasado más de 30 segundos, **o**
  - Haber completado una acción de valor.
- Mostrar el banner demasiado pronto quema el evento y baja la conversión.

**Capa 2 — Banner no intrusivo (no modal bloqueante)**
- Barra delgada superior o tarjeta flotante en esquina inferior.
- Siempre con botón "X" visible para cerrar sin instalar.
- Guardar rechazo en `localStorage` con cooldown de 7 a 30 días.
- Detectar si ya está instalada (`display-mode: standalone`) y ocultar todo.

**Capa 3 — Comportamiento híbrido**
- Si existe `beforeinstallprompt` → Lanzar instalación nativa.
- Si no existe → Mostrar instrucciones visuales (con capturas o GIFs) por SO.

### Lo que las grandes empresas NO hacen

| Antipatrón | Problema |
|:---|:---|
| Modal bloqueante al cargar la página | El usuario rechaza por reflejo |
| Repetir el banner en cada visita | Genera rechazo y reseñas negativas |
| Botón "Instalar" sin explicar beneficios | Baja confianza y conversión |
| Ignorar iOS porque "no soporta PWA" | iOS sí soporta "Add to Home Screen" desde Safari |
| Intentar forzar instalación con dark patterns | Google y Apple penalizan en rankings |

---

## 7. Recomendación final para AVI

### Solución recomendada: Híbrida

```
1. Corregir manifest (iconos 192 + 512 con purpose "any")    ← Solución A
2. Implementar banner discreto (no modal bloqueante al inicio) ← Patrón profesional
3. Comportamiento híbrido beforeinstallprompt / instrucciones  ← Solución B como fallback
4. Guardar rechazo en localStorage (cooldown 14 días)          ← Buena práctica
5. Detectar modo standalone para ocultar el banner             ← Buena práctica
```

### Stack recomendado

- **`vite-plugin-pwa`** — ya instalado, solo corregir configuración.
- **`@khmyznikov/pwa-install`** — Web Component profesional que ya incluye
  detección de plataforma, modal con instrucciones, manejo de `beforeinstallprompt`
  y soporte para Safari, Firefox, Chrome y Edge.

---

## 8. Archivos clave del proyecto

| Archivo | Acción |
|:---|:---|
| `client/vite.config.ts` | Corregir iconos del manifest (agregar 512 `any`) |
| `client/src/components/ui/InstallPWAButton.tsx` | Refactorizar a banner híbrido con cooldown |
| `client/src/App.jsx` | Mantener montaje global del banner |
| `client/public/assets/` | Verificar existencia de `icon-192x192.png` e `icon-512x512.png` |

---

## 9. Checklist de verificación

```
[ ] Iconos 192x192 y 512x512 con purpose "any" en el manifest
[ ] start_url y scope declarados explícitamente como "/"
[ ] Service Worker activo en DevTools → Application → Service Workers
[ ] DevTools → Application → Manifest → sección Installability sin errores
[ ] Probar en ventana incógnita sin instancias previas de AVI
[ ] Banner oculto si display-mode es standalone (ya instalada)
[ ] Rechazo guardado en localStorage con cooldown
[ ] Instrucciones visuales para iOS como fallback
```

---

*Reporte generado como parte del caso AVI — AVI / LibreChat*
```