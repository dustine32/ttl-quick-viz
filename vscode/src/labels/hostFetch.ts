// Bridge for the webview's labels feature (site/src/features/labels/golrClient.ts).
//
// Webview CSP blocks JSONP and external fetch; the host (Node) makes the
// GOlr call instead, then posts the JSON back to the webview. The webview
// shim (site/src/webview/labelsHostFetch.ts) reassembles a Promise<unknown>
// that golrClient.ts consumes unchanged.

const ALLOWED_HOSTS = new Set(['noctua-golr.berkeleybop.org']);

const FETCH_TIMEOUT_MS = 30000;

export type LabelsFetchResult =
  | { ok: true; json: unknown }
  | { ok: false; error: string };

export async function labelsFetch(url: string): Promise<LabelsFetchResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, error: 'invalid URL: ' + url };
  }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return { ok: false, error: 'host not allowed: ' + parsed.hostname };
  }

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    if (!res.ok) {
      return { ok: false, error: 'HTTP ' + String(res.status) + ' ' + res.statusText };
    }
    const json = (await res.json()) as unknown;
    return { ok: true, json };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: msg };
  } finally {
    clearTimeout(timer);
  }
}
