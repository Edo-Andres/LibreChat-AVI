/* eslint-disable i18next/no-literal-string */
import { useEffect, useState, useRef } from 'react';
import { OGDialog, OGDialogContent } from '@librechat/client';
import { Download, X, Eye } from 'lucide-react';

const STORAGE_KEY = 'avi_pwa_install_rejected_v3';
const COOLDOWN_DAYS = 0.5; // 12 hours - can be adjusted as needed
const DELAY_MS = 2000;
const MIN_NAVIGATIONS = 0; // Show after 0 navigations (i.e. immediately) - can be adjusted if needed
const FALLBACK_TIMEOUT_MS = 5000;

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

type Mode = 'idle' | 'install' | 'tutorial';

const InstallPWAButton = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<Event | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [mode, setMode] = useState<Mode>('idle');
  const [showLightbox, setShowLightbox] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fallbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navCountRef = useRef(0);
  const promptReceivedRef = useRef(false);

  useEffect(() => {
    if (isStandalone() || wasRecentlyRejected()) {
      return;
    }

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      promptReceivedRef.current = true;
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
      setDeferredPrompt(e);
      setMode('install');
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsVisible(false);
      setMode('idle');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    fallbackTimerRef.current = setTimeout(() => {
      if (!promptReceivedRef.current) {
        setMode('tutorial');
      }
    }, FALLBACK_TIMEOUT_MS);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
      if (fallbackTimerRef.current) {
        clearTimeout(fallbackTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (mode === 'idle') {
      return;
    }

    timerRef.current = setTimeout(() => {
      setIsReady(true);
    }, DELAY_MS);

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
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
      window.removeEventListener('popstate', handleRouteChange);
      history.pushState = origPushState;
      history.replaceState = origReplaceState;
    };
  }, [mode]);

  useEffect(() => {
    if (isReady && mode !== 'idle') {
      setIsVisible(true);
    }
  }, [isReady, mode]);

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
    setMode('idle');
  };

  return (
    <>
      {mode === 'tutorial' && (
        <OGDialog open={showLightbox} onOpenChange={setShowLightbox}>
          <OGDialogContent
            showCloseButton={true}
            className="w-[95vw] border-none bg-transparent p-0 sm:max-w-3xl md:max-w-4xl lg:max-w-5xl"
            overlayClassName="bg-black/90"
          >
            <img
              src="assets/img_avi/tutorial_install_app.png"
              alt="Tutorial de instalación de AVI"
              className="h-auto max-h-[75vh] w-full rounded-lg object-contain sm:max-h-[80vh] md:max-h-[85vh]"
            />
          </OGDialogContent>
        </OGDialog>
      )}

      {isVisible && mode === 'tutorial' && (
        <div className="bg-surface-primary-alt/95 fixed bottom-4 right-4 z-[1000] w-[min(92vw,24rem)] rounded-2xl border border-white/10 p-4 shadow-2xl shadow-black/40 backdrop-blur">
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
              onClick={() => { setShowLightbox(true); setIsVisible(false); }}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:opacity-95"
            >
              <Eye className="h-4 w-4" />
              Ver pasos
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
      )}

      {isVisible && mode === 'install' && (
        <div className="bg-surface-primary-alt/95 fixed bottom-4 right-4 z-[1000] w-[min(92vw,24rem)] rounded-2xl border border-white/10 p-4 shadow-2xl shadow-black/40 backdrop-blur">
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
      )}
    </>
  );
};

export default InstallPWAButton;
