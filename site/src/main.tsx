import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { store } from '@/app/store';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import App from '@/App';
import '@/index.css';

const theme = createTheme({
  primaryColor: 'sky',
  primaryShade: { light: 6, dark: 5 },
  defaultRadius: 'md',
  fontFamily:
    "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
  headings: {
    fontFamily:
      "-apple-system, BlinkMacSystemFont, 'Segoe UI', Inter, system-ui, sans-serif",
    fontWeight: '600',
  },
  colors: {
    sky: [
      '#E6F4FF',
      '#BAE0FF',
      '#91CAFF',
      '#69B1FF',
      '#4FB3FF',
      '#2E94F0',
      '#1677FF',
      '#0958D9',
      '#003EB3',
      '#002C8C',
    ],
  },
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Provider store={store}>
      <MantineProvider theme={theme} forceColorScheme="light">
        <Notifications position="bottom-right" />
        <ErrorBoundary>
          <App />
        </ErrorBoundary>
      </MantineProvider>
    </Provider>
  </StrictMode>,
);
