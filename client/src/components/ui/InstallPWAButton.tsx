import { useEffect, useState, useRef } from 'react';
import { Download, X } from 'lucide-react';

const STORAGE_KEY = 'avi_pwa_install_rejected';
const COOLDOWN_DAYS = 14;
const DELAY_MS = 30000;
const MIN_NAVIGATIONS = 2;

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

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
  const [isReady, setIsReady] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navCountRef = useRef(0);

  useEffect(() => {
    if (isStandalone() || wasRecentlyRejected()) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsVisible(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    if (!deferredPrompt) {
      return;
    }

    timerRef.current = setTimeout(() => {
      setIsReady(true);
    }, DELAY_MS);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [deferredPrompt]);

  useEffect(() => {
    if (!deferredPrompt) {
      return;
    }

    const handleRouteChange = () => {
      navCountRef.current += 1;
      if (navCountRef.current >= MIN_NAVIGATIONS) {
        setIsReady(true);
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
  }, [deferredPrompt]);

  useEffect(() => {
    if (isReady && deferredPrompt) {
      setIsVisible(true);
    }
  }, [isReady, deferredPrompt]);

  const handleInstallClick = async () => {
    if (!deferredPrompt) {
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

  if (!isVisible) {
    return null;
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
          Instalar ahora
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
