// Webview replacement for site/src/features/labels/jsonpRequest.ts.
//
// The webview CSP forbids loading external scripts (no JSONP) and
// connect-src 'none' rules out direct fetch. We bridge GOlr through the
// extension host: the webview posts the URL, the host fetches it (Node's
// fetch has no CORS), and posts the parsed JSON back. golrClient.ts is
// unchanged — vite.config.webview.ts aliases the jsonpRequest path to this
// module.
import { postToHost } from '@/webview/vscodeBridge';

type LabelsFetchedMessage = {
  type: 'labels/fetched';
  requestId: number;
  ok: boolean;
  json?: unknown;
  error?: string;
};

type Pending = {
  resolve: (json: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const pending = new Map<number, Pending>();
let nextId = 1;

if (typeof window !== 'undefined') {
  window.addEventListener('message', (event: MessageEvent<unknown>) => {
    const msg = event.data as LabelsFetchedMessage | undefined;
    if (!msg || typeof msg !== 'object' || msg.type !== 'labels/fetched') return;
    const entry = pending.get(msg.requestId);
    if (!entry) return;
    pending.delete(msg.requestId);
    clearTimeout(entry.timer);
    if (msg.ok) entry.resolve(msg.json);
    else entry.reject(new Error(msg.error ?? 'labels/fetch failed'));
  });
}

export function jsonpRequest(url: string, timeoutMs = 30000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const requestId = nextId;
    nextId += 1;
    const timer = setTimeout(() => {
      pending.delete(requestId);
      reject(new Error('GOlr request timed out: ' + url));
    }, timeoutMs);
    pending.set(requestId, { resolve, reject, timer });
    postToHost({ type: 'labels/fetch', requestId, url });
  });
}
