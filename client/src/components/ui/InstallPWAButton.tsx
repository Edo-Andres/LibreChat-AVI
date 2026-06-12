import { useEffect, useState, useCallback, useRef } from 'react';
import { Download, X, Monitor, Smartphone, Apple } from 'lucide-react';

const STORAGE_KEY = 'avi_pwa_install_rejected';
const COOLDOWN_DAYS = 14;
const DELAY_MS = 30000;
const MIN_NAVIGATIONS = 2;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

const isIOS = () => /iphone|ipad|ipod/.test(navigator.userAgent.toLowerCase());
const isAndroid = () => /android/.test(navigator.userAgent.toLowerCase());
const isMobile = () => isIOS() || isAndroid();

const getPlatformInstructions = () => {
  if (isIOS()) {
    return {
      icon: Apple,
      title: 'Instalar en iOS',
      steps: [
        'Toca el botón Compartir en Safari',
        'Desplázate y selecciona "Añadir a pantalla de inicio"',
        'Toca "Añadir" para confirmar',
      ],
    };
  }
  if (isAndroid()) {
    return {
      icon: Smartphone,
      title: 'Instalar en Android',
      steps: [
        'Toca el menú ⋮ en Chrome',
        'Selecciona "Instalar aplicación"',
        'Toca "Instalar" para confirmar',
      ],
    };
  }
  return {
    icon: Monitor,
    title: 'Instalar en escritorio',
    steps: [
      'Haz clic en el menú ⋮ de Chrome/Edge',
      'Selecciona "Guardar y compartir"',
      'Haz clic en "Instalar página como app"',
    ],
  };
};

const wasRecentlyRejected = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      return false;
    }
    const rejectedAt = parseInt(stored, 10);
    const cooldownMs = COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
    return Date.now() - rejectedAt < cooldownMs;
  } catch {
    return false;
  }
};

const markRejected = () => {
  try {
    localStorage.setItem(STORAGE_KEY, Date.now().toString());
  } catch {
    /* storage unavailable */
  }
};

const InstallPWAButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [showInstructions, setShowInstructions] = useState(false);
  const [isEligible, setIsEligible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navCountRef = useRef(0);

  const canShow = useCallback(() => {
    if (isStandalone()) {
      return false;
    }
    if (wasRecentlyRejected()) {
      return false;
    }
    return isEligible;
  }, [isEligible]);

  const tryShow = useCallback(() => {
    if (canShow()) {
      setIsVisible(true);
    }
  }, [canShow]);

  useEffect(() => {
    if (isStandalone()) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsEligible(true);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsVisible(false);
      setIsEligible(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    timerRef.current = setTimeout(() => {
      if (!deferredPrompt) {
        setIsEligible(true);
      }
      tryShow();
    }, DELAY_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [tryShow, deferredPrompt]);

  useEffect(() => {
    const handleRouteChange = () => {
      navCountRef.current += 1;
      if (navCountRef.current >= MIN_NAVIGATIONS) {
        tryShow();
      }
    };

    window.addEventListener('popstate', handleRouteChange);

    const origPushState = history.pushState.bind(history);
    const origReplaceState = history.replaceState.bind(history);

    history.pushState = (...args) => {
      origPushState(...args);
      handleRouteChange();
    };
    history.replaceState = (...args) => {
      origReplaceState(...args);
    };

    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
    };
  }, [tryShow]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
      setShowInstructions(true);
      return;
    }

    const promptEvent = deferredPrompt as Event & {
      prompt: () => Promise<void>;
      userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
    };

    promptEvent.prompt();
    const { outcome } = await promptEvent.userChoice;
    setDeferredPrompt(null);
    if (outcome === 'accepted') {
      setIsVisible(false);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    markRejected();
  };

  const handleDismissInstructions = () => {
    setShowInstructions(false);
    setIsVisible(false);
    markRejected();
  };

  if (!isVisible) {
    return null;
  }

  const instructions = getPlatformInstructions();
  const InstructionsIcon = instructions.icon;

  if (showInstructions) {
    return (
      <div className="fixed inset-0 z-[1001] flex items-center justify-center bg-black/50 backdrop-blur-sm" onClick={handleDismissInstructions}>
        <div
          className="mx-4 w-full max-w-sm rounded-2xl border border-white/10 bg-surface-primary-alt p-6 shadow-2xl shadow-black/40"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <InstructionsIcon className="h-5 w-5 text-primary" />
              <p className="text-base font-semibold text-text-primary">{instructions.title}</p>
            </div>
            <button
              type="button"
              onClick={handleDismissInstructions}
              className="rounded-full p-1 text-text-secondary transition hover:bg-black/10 hover:text-text-primary"
              aria-label="Cerrar instrucciones"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <ol className="space-y-2">
            {instructions.steps.map((step, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-text-secondary">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
          <button
            type="button"
            onClick={handleDismissInstructions}
            className="mt-4 w-full rounded-lg bg-surface-hover py-2 text-sm font-medium text-text-secondary transition hover:bg-black/10"
          >
            Entendido
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 z-[1000] w-[min(92vw,24rem)] rounded-2xl border border-white/10 bg-surface-primary-alt/95 p-4 shadow-2xl shadow-black/40 backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-text-primary">Instalar AVI</p>
          <p className="mt-1 text-sm text-text-secondary">
            Agrega la app a tu escritorio para abrirla más rápido y usarla como una aplicación.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full p-1 text-text-secondary transition hover:bg-black/10 hover:text-text-primary"
          aria-label="Cerrar aviso de instalación"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={handleInstallClick}
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
        >
          <Download className="h-4 w-4" />
          {deferredPrompt ? 'Instalar ahora' : 'Crear acceso directo'}
        </button>
        <button
          type="button"
          onClick={handleDismiss}
          className="rounded-full px-3 py-2 text-sm font-medium text-text-secondary transition hover:bg-black/10 hover:text-text-primary"
        >
          Después
        </button>
      </div>
    </div>
  );
};

export default InstallPWAButton;
