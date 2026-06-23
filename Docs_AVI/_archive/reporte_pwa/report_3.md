```markdown
# Solución: Modal de instalación PWA no aparece en usuarios antiguos

## 🚩 Revisar el diagnóstico primero
La solución de "versionar la key" probablemente NO ataca la causa raíz:
- Si la versión anterior no tenía PWA, la key `avi_pwa_install_rejected` nunca se creó.
- El hecho de tener que borrar **"datos del sitio"** (no solo localStorage) apunta a un **Service Worker viejo cacheado**, no a la key.

## 🎯 Causa raíz más probable
1. La versión anterior registró un **Service Worker**.
2. Ese SW sirve HTML/JS **cacheado** sin la nueva lógica PWA.
3. El evento `beforeinstallprompt` se podria estar perdiendo o el listener vive en código viejo.
4. Hasta borrar "datos del sitio", el SW viejo sigue activo.

---

## ✅ Soluciones (en orden de prioridad)

### 1. Verificar con DevTools (5 min)
En un usuario afectado → DevTools → Application:
- ¿Existe la key `avi_pwa_install_rejected` en localStorage?
- ¿Hay un Service Worker registrado y qué versión?
- ¿Qué hay en Cache Storage?

### 2. Manejar correctamente el Service Worker (solución real)

**En el SW (`sw.js`):**
```js
self.addEventListener('install', (event) => {
  self.skipWaiting(); // Activa el nuevo SW inmediatamente
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(key => caches.delete(key)))) // Limpia caches viejos
      .then(() => self.clients.claim()) // Toma control de pestañas abiertas
  );
});
```

**En el cliente (registro):**
```js
navigator.serviceWorker.register('/sw.js').then(reg => {
  reg.addEventListener('updatefound', () => {
    const newSW = reg.installing;
    newSW.addEventListener('statechange', () => {
      if (newSW.state === 'activated') {
        window.location.reload(); // Recarga con el nuevo SW
      }
    });
  });
});
```

### 3. Capturar `beforeinstallprompt` lo antes posible

**En `index.html`, antes de cargar React:**
```html
<script>
  window.__deferredPrompt = null;
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    window.__deferredPrompt = e;
    window.dispatchEvent(new CustomEvent('pwa-installable'));
  });
</script>
```

En `InstallPWAButton.tsx`: lee de `window.__deferredPrompt` y escucha el evento `pwa-installable`. Así nunca pierdes el evento aunque React tarde en montar.

### 4. Si versionas la key, limpia la vieja también
```ts
const STORAGE_KEY = 'avi_pwa_install_rejected_v2';
localStorage.removeItem('avi_pwa_install_rejected'); // Migración: limpiar key antigua
```

---

## 📊 Comparación

| Solución | Resuelve causa raíz | Esfuerzo | Recomendación |
|----------|:-------------------:|:--------:|---------------|
| Versionar key (A) | ❌ Probablemente no | Bajo | Solo parche temporal |
| Limpiar SW + skipWaiting | ✅ Sí | Medio | **La correcta** |
| Capturar prompt en index.html | ✅ Sí | Bajo | **Hazla siempre** |
| Versionar + limpiar key vieja | ⚠️ Parcial | Bajo | Complemento útil |

---

## 🎬 Recomendación final
1. **Primero:** verifica con DevTools qué bloquea realmente el modal.
2. **Si es el SW** (lo más probable): `skipWaiting` + `clients.claim` + limpieza de caches.
3. **Siempre:** mueve la captura de `beforeinstallprompt` a `index.html`.
4. **Versionar la key:** solo como complemento, no como solución principal.
```

