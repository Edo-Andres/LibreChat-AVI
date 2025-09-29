import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import { StrictMode } from 'react';
import './locales/i18n';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import { PostHogProvider } from './Providers';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <StrictMode>
    <PostHogProvider>
      <ApiErrorBoundaryProvider>
        <App />
      </ApiErrorBoundaryProvider>
    </PostHogProvider>
  </StrictMode>,
);