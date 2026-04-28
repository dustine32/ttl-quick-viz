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
  primaryColor: 'mauve',
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
    mauve: [
      '#F4ECFF',
      '#E5D2FF',
      '#D2B0FF',
      '#BC8AFF',
      '#A968FF',
      '#9B4BFF',
      '#8839EF',
      '#7C2DD8',
      '#6620B8',
      '#4F189A',
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
