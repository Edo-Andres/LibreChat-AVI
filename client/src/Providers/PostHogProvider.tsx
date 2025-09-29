import { createContext, useContext, useEffect, useMemo, useState, ReactNode } from 'react';
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

  const contextValue = useMemo(() => ({
    posthog: config?.posthogKey ? posthog : null,
    isLoaded,
  }), [config, isLoaded]);

  if (config?.posthogKey) {
    return (
      <PostHogContext.Provider value={contextValue}>
        <PHProvider
          apiKey={config.posthogKey}
          options={{
            api_host: config.posthogHost ?? 'https://us.i.posthog.com',
            defaults: '2025-05-24',
            capture_exceptions: true,
            debug: import.meta.env.MODE === 'development',
          }}
        >
          {children}
        </PHProvider>
      </PostHogContext.Provider>
    );
  }

  return <PostHogContext.Provider value={contextValue}>{children}</PostHogContext.Provider>;
};

export default PostHogProvider;
