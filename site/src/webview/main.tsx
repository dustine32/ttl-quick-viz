import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { createTheme, MantineProvider } from '@mantine/core';
import { Notifications } from '@mantine/notifications';
import { store } from '@/app/store';
import { ErrorBoundary } from '@/shared/components/ErrorBoundary';
import { setSelectedGraphId } from '@/features/graph/slices/graphSlice';
import { graphApi } from '@/features/graph/slices/graphApiSlice';
import { setLeftPanelOpen } from '@/features/ui';
import { setViewerMode } from '@/features/viewer';
import App from '@/App';
import { setWebviewGraph } from '@/webview/webviewBaseQuery';
import { postToHost } from '@/webview/vscodeBridge';
import type { Graph } from '@/features/graph/types';
import '@/index.css';

setViewerMode('webview');
store.dispatch(setLeftPanelOpen(false));

window.addEventListener('error', (e) => {
  postToHost({
    type: 'webview/error',
    message: e.message,
    source: e.filename,
    line: e.lineno,
    col: e.colno,
    stack: (e.error && e.error.stack) || null,
  });
});
window.addEventListener('unhandledrejection', (e) => {
  const reason = e.reason as { stack?: string; message?: string } | string | undefined;
  postToHost({
    type: 'webview/error',
    message: typeof reason === 'string' ? reason : (reason && (reason.stack || reason.message)) || 'unhandledrejection',
  });
});

type HostMessage =
  | { type: 'graph/load'; graph: Graph; ttlText: string; fileName: string }
  | { type: 'graph/error'; message: string; fileName: string };

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

window.addEventListener('message', (event: MessageEvent<HostMessage>) => {
  const msg = event.data;
  if (!msg || typeof msg !== 'object') return;

  if (msg.type === 'graph/load') {
    const id = msg.fileName.replace(/\.ttl$/i, '');
    setWebviewGraph({ id, graph: msg.graph, ttl: msg.ttlText, fileName: msg.fileName });
    store.dispatch(setSelectedGraphId(id));
    store.dispatch(
      graphApi.util.invalidateTags([
        { type: 'Graph', id },
        { type: 'GraphTtl', id },
        { type: 'Graphs', id: 'LIST' },
      ]),
    );
  }
});

try {
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
  postToHost({ type: 'webview/log', message: 'createRoot.render() returned' });
} catch (err) {
  const e = err as Error;
  postToHost({ type: 'webview/error', message: 'render threw: ' + (e.stack || e.message) });
}

declare global {
  interface Window {
    __ttlQuickVizBootLoaded?: () => void;
  }
}

window.__ttlQuickVizBootLoaded?.();
postToHost({ type: 'webview/ready' });

// React renders asynchronously after createRoot.render(). Probe the DOM a
// bit later to confirm the App tree actually mounted (catches the case where
// render() returns successfully but components throw on first commit).
setTimeout(() => {
  const root = document.getElementById('root');
  postToHost({
    type: 'webview/log',
    message: 'DOM probe @100ms: #root.childElementCount=' + (root?.childElementCount ?? 'null') + ', innerText.length=' + (root?.innerText.length ?? 0),
  });
}, 100);
setTimeout(() => {
  const root = document.getElementById('root');
  postToHost({
    type: 'webview/log',
    message: 'DOM probe @1500ms: #root.childElementCount=' + (root?.childElementCount ?? 'null') + ', innerText.length=' + (root?.innerText.length ?? 0),
  });
}, 1500);
