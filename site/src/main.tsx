import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { MantineProvider } from '@mantine/core';
import { store } from '@/app/store';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import App from '@/App';
import '@/index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <MantineProvider>
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MantineProvider>
    </Provider>
  </StrictMode>,
);
