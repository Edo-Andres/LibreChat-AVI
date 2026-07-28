**Aquí tienes las recomendaciones resumidas y listas para copiar:**

```markdown
# Solución al Problema del Modal de Instalación PWA

## Diagnóstico
El problema **no son las cookies**, sino `localStorage`. Los usuarios que visitaron la versión anterior tienen guardada la clave:

```ts
const STORAGE_KEY = 'avi_pwa_install_rejected';
```

Esto hace que la función `wasRecentlyRejected()` devuelva `true` durante 14 días, bloqueando el modal. Además, el código actual probablemente está impidiendo registrar el evento `beforeinstallprompt` cuando detecta un rechazo previo.

---

## 1. Solución Rápida (Hotfix)

Cambia la clave añadiendo una versión:

```ts
// Cambiar esto
const STORAGE_KEY = 'avi_pwa_install_rejected';

// Por esto
const STORAGE_KEY = 'avi_pwa_install_rejected_v2';
```

**Ventaja:** Los usuarios antiguos no tendrán la nueva clave, por lo que volverán a ver el modal.

**Regla:** Solo incrementa la versión (`_v3`, `_v4`, etc.) cuando cambies significativamente el diseño, texto o lógica del modal.

---

## 2. Solución Recomendada (Mejor a Largo Plazo)

Usa un **objeto versionado** en lugar de una clave simple. Es más mantenible y profesional.

### Código recomendado:

```ts
const INSTALL_PROMPT_VERSION = 2;
const STORAGE_KEY = 'avi_pwa_install_state';

type InstallPWAState = {
  version: number;
  rejectedAt?: number;
  installedAt?: number;
};

function getInstallState(): InstallPWAState | null {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

function wasRecentlyRejected(): boolean {
  const state = getInstallState();
  if (!state || state.version !== INSTALL_PROMPT_VERSION) return false;
  if (!state.rejectedAt) return false;

  const COOLDOWN = 14 * 24 * 60 * 60 * 1000; // 14 días
  return Date.now() - state.rejectedAt < COOLDOWN;
}

function markRejected() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: INSTALL_PROMPT_VERSION,
    rejectedAt: Date.now()
  }));
}

function markInstalled() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    version: INSTALL_PROMPT_VERSION,
    installedAt: Date.now()
  }));
}

function migrateOldKeys() {
  localStorage.removeItem('avi_pwa_install_rejected');
  // Agrega aquí otras claves antiguas si existen
}
```

### Cambios importantes en el componente:

- Llama a `migrateOldKeys()` al montar el componente.
- **Siempre registra** el listener de `beforeinstallprompt` (no lo bloquees con `wasRecentlyRejected()`).
- Solo usa esa función para decidir si **mostrar el modal** o no.

```tsx
useEffect(() => {
  migrateOldKeys();
  if (isStandalone()) return;

  const handleBeforeInstallPrompt = (e: Event) => {
    e.preventDefault();
    setDeferredPrompt(e as BeforeInstallPromptEvent);
    
    if (!wasRecentlyRejected()) {
      setShowInstallModal(true);
    }
  };

  window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  
  return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
}, []);
```

---

## Recomendaciones Finales

- Implementa primero el **Hotfix (_v2)** para solucionar el problema de los usuarios actuales rápidamente.
- Refactoriza luego a la **solución con objeto versionado** (recomendada).
- Cambia `INSTALL_PROMPT_VERSION` **solo** cuando quieras que los usuarios que ya rechazaron vean nuevamente el modal.
- No uses el Service Worker para limpiar el `localStorage` (es más complejo y menos recomendable en este caso).

**Resultado:** Los usuarios ya no tendrán que borrar datos del sitio para ver el modal de instalación.
```