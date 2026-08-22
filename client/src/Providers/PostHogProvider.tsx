import { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { PostHogProvider as PHProvider } from 'posthog-js/react';
import posthog from 'posthog-js';

type PostHogConfig = {
  posthogKey?: string;
  posthogHost?: string;
};

interface PostHogContextType {
  posthog: typeof posthog | null;
  isLoaded: boolean;
}

const PostHogContext = createContext<PostHogContextType>({
  posthog: null,
  isLoaded: false,
});

export const usePostHog = () => {
  const context = useContext(PostHogContext);
  return context.posthog;
};

export const usePostHogLoaded = () => {
  const context = useContext(PostHogContext);
  return context.isLoaded;
};

interface ProviderProps {
  children: ReactNode;
}

export const PostHogProvider = ({ children }: ProviderProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [config, setConfig] = useState<PostHogConfig | null>(null);
  const [client, setClient] = useState<typeof posthog | null>(null);
  const initializedRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchConfig = async () => {
      if (typeof window === 'undefined' || typeof fetch !== 'function') {
        if (isMounted) {
          setIsLoaded(true);
        }
        return;
      }

      try {
        const response = await fetch('/api/config');
        if (!response.ok) {
          throw new Error(`Failed to fetch config: ${response.status}`);
        }
        const data = await response.json();
        if (!isMounted) {
          return;
        }
        setConfig({
          posthogKey: data.posthogKey,
          posthogHost: data.posthogHost,
        });
      } catch (error) {
        if (isMounted) {
          setConfig(null);
        }
      } finally {
        if (isMounted) {
          setIsLoaded(true);
        }
      }
    };

    fetchConfig();

    return () => {
      isMounted = false;
    };
  }, []);

  /**
   * Init explícito: `PHProvider` inicializa dentro de un `useEffect` propio, y los
   * efectos de React corren bottom-up, así que un consumidor descendiente podría
   * llamar a identify/capture antes del init — posthog-js no encola esas llamadas
   * y se perderían en silencio. Inicializando aquí, el contexto solo publica el
   * cliente una vez listo, y `usePostHog()` devuelve null hasta entonces.
   */
  useEffect(() => {
    if (!config?.posthogKey || initializedRef.current) {
      return;
    }
    initializedRef.current = true; // idempotente bajo StrictMode (doble efecto en dev)
    posthog.init(config.posthogKey, {
      api_host: config.posthogHost ?? 'https://us.i.posthog.com',
      defaults: '2025-05-24',
      capture_exceptions: true,
      debug: import.meta.env.MODE === 'development',
    });
    setClient(posthog);
  }, [config?.posthogKey, config?.posthogHost]);

  const contextValue = useMemo(
    () => ({
      posthog: client,
      isLoaded,
    }),
    [client, isLoaded],
  );

  if (client) {
    return (
      <PostHogContext.Provider value={contextValue}>
        {/* al recibir `client`, PHProvider no vuelve a inicializar */}
        <PHProvider client={client}>{children}</PHProvider>
      </PostHogContext.Provider>
    );
  }

  return <PostHogContext.Provider value={contextValue}>{children}</PostHogContext.Provider>;
};

export default PostHogProvider;
