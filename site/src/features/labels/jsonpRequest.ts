// JSONP transport for cross-origin GOlr requests.
//
// noctua-golr.berkeleybop.org doesn't return CORS headers, so a normal
// `fetch` is blocked by the browser. The legacy fix — still the canonical
// one for this service — is to inject a <script> whose `src` is the GOlr
// query plus `json.wrf=<cb>`. Solr wraps the response body in a call to
// that callback; the script tag executes it; we resolve the promise.
//
// Limitations vs. fetch:
// - No abort signal. Closing the script tag cancels nothing on the server;
//   we just no-op the callback if removed early.
// - No HTTP status; on 4xx/5xx the script body is empty and `onerror` fires.
// - Has to run in a real DOM. Vitest's jsdom is fine; node-only tests must
//   mock this module.

// Solr's json.wrf parameter only accepts alphanumeric + underscore — no
// dots — so we register callbacks as flat properties on window. Name shape
// matches noctua-form-base-rt's createJsonpScript exactly to rule out any
// pedantic Solr json.wrf validation.
export function jsonpRequest(url: string, timeoutMs = 30000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const cbName = 'jsonp_callback_' + Math.round(Math.random() * 1_000_000);
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = url + sep + 'json.wrf=' + cbName;
    const script = document.createElement('script');
    script.async = true;
    script.type = 'text/javascript';

    const w = window as unknown as Record<string, unknown>;

    let settled = false;
    const cleanup = () => {
      delete w[cbName];
      if (script.parentNode) script.parentNode.removeChild(script);
      window.clearTimeout(timer);
    };

    w[cbName] = (data: unknown) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(data);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('JSONP request failed: ' + url));
    };

    const timer = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(new Error('JSONP request timed out: ' + url));
    }, timeoutMs);

    script.src = fullUrl;
    document.body.appendChild(script);
  });
}
