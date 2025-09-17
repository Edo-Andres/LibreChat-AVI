import './matchMedia.mock';
import React from 'react';
import { render as rtlRender } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthContextProvider } from '~/hooks/AuthContext';
import { BrowserRouter as Router } from 'react-router-dom';
import { RecoilRoot } from 'recoil';
import { PostHogProvider } from 'posthog-js/react';

const client = new QueryClient();

function renderWithProvidersWrapper(ui, { ...options } = {}) {
  function Wrapper({ children }) {
    return (
      <QueryClientProvider client={client}>
        <RecoilRoot>
          <Router>
            <PostHogProvider
              apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
              options={{
                api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
                defaults: '2025-05-24',
                capture_exceptions: true,
                debug: import.meta.env.MODE === 'development',
              }}
            >
              <AuthContextProvider
                authConfig={{
                  loginRedirect: '',
                  test: true,
                }}
              >
                {children}
              </AuthContextProvider>
            </PostHogProvider>
          </Router>
        </RecoilRoot>
      </QueryClientProvider>
    );
  }
  return rtlRender(ui, { wrapper: Wrapper, ...options });
}

export * from '@testing-library/react';
export { renderWithProvidersWrapper as render };