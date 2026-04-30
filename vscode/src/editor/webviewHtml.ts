import * as vscode from 'vscode';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

type ViteManifestEntry = {
  file: string;
  css?: string[];
};

type ViteManifest = Record<string, ViteManifestEntry>;

export type WebviewAssets = {
  scriptUri: vscode.Uri;
  cssUris: vscode.Uri[];
};

export function loadWebviewAssets(
  context: vscode.ExtensionContext,
  webview: vscode.Webview,
): WebviewAssets | undefined {
  const mediaPath = join(context.extensionUri.fsPath, 'media');
  const manifestPath = join(mediaPath, '.vite', 'manifest.json');
  if (!existsSync(manifestPath)) return undefined;

  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as ViteManifest;
  const entry = manifest['index.webview.html'];
  if (!entry) return undefined;

  const mediaUri = vscode.Uri.joinPath(context.extensionUri, 'media');
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, entry.file));
  const cssUris = (entry.css ?? []).map((p) =>
    webview.asWebviewUri(vscode.Uri.joinPath(mediaUri, p)),
  );
  return { scriptUri, cssUris };
}

export function renderWebviewHtml(
  webview: vscode.Webview,
  assets: WebviewAssets,
  fileName: string,
): string {
  const nonce = generateNonce();
  const csp = buildCsp(webview.cspSource, nonce);
  const cssTags = assets.cssUris
    .map((u) => `<link rel="stylesheet" href="${u}" />`)
    .join('\n    ');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <title>${escapeHtml(fileName)}</title>
    <style nonce="${nonce}">
      html, body, #root { height: 100%; margin: 0; }
      #ttl-boot {
        position: fixed; inset: 0;
        display: flex; flex-direction: column;
        align-items: center; justify-content: center; gap: 0.75rem;
        padding: 1.5rem; text-align: center;
        font-family: var(--vscode-font-family);
        color: var(--vscode-foreground);
        background: var(--vscode-editor-background);
      }
      #ttl-boot pre {
        max-width: 100%; max-height: 50vh;
        overflow: auto; padding: 0.75rem;
        background: var(--vscode-textCodeBlock-background);
        border-radius: 4px;
        font-size: 0.75rem; text-align: left; white-space: pre-wrap;
      }
      #ttl-boot.err strong { color: var(--vscode-errorForeground); }
    </style>
    ${cssTags}
  </head>
  <body>
    <div id="ttl-boot">
      <div><strong>TTL Quick Viz</strong> &middot; loading&hellip;</div>
      <div style="opacity:0.7; font-size:0.85rem;">${escapeHtml(fileName)}</div>
    </div>
    <div id="root"></div>
    <script nonce="${nonce}">${bootDiagnosticScript(assets.scriptUri.toString())}</script>
    <script type="module" nonce="${nonce}" src="${assets.scriptUri}"></script>
  </body>
</html>`;
}

export function renderMissingBundleHtml(webview: vscode.Webview, fileName: string): string {
  const nonce = generateNonce();
  const csp = [
    `default-src 'none'`,
    `style-src ${webview.cspSource} 'nonce-${nonce}'`,
    `script-src 'nonce-${nonce}'`,
  ].join('; ');

  return /* html */ `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="${csp}" />
    <style nonce="${nonce}">
      body {
        font-family: var(--vscode-font-family);
        padding: 1.5rem;
        color: var(--vscode-foreground);
      }
      code {
        background: var(--vscode-textCodeBlock-background);
        padding: 0 0.25rem;
        border-radius: 3px;
      }
      .err { color: var(--vscode-errorForeground); }
    </style>
  </head>
  <body>
    <h2>TTL Quick Viz</h2>
    <p>${escapeHtml(fileName)}</p>
    <p class="err">Webview bundle not found.</p>
    <p>Run <code>npm run build:webview</code> from <code>vscode/</code> to build the React bundle into <code>media/</code>.</p>
  </body>
</html>`;
}

// CSP rationale (this is a local dev tool, not a production webview):
//   - 'unsafe-inline' for style-src: Mantine v9 uses emotion which injects
//     <style> tags at runtime; wiring a nonce all the way through Mantine
//     is fragile, and the risk surface is just our own code.
//   - 'unsafe-eval' for script-src: weaverjs (transitively pulled by
//     cytoscape-spread) uses direct eval. Code-splitting it out is a
//     follow-up; for v1 we accept the relaxation.
//   - blob: for img-src so any inlined SVG / generated images load.
function buildCsp(cspSource: string, nonce: string): string {
  return [
    `default-src 'none'`,
    `style-src ${cspSource} 'unsafe-inline'`,
    `script-src ${cspSource} 'nonce-${nonce}' 'unsafe-eval'`,
    `img-src ${cspSource} data: blob:`,
    `font-src ${cspSource} data:`,
    `connect-src 'none'`,
  ].join('; ');
}

// Inline script that catches load failures *before* the bundle initializes,
// so a CSP block or a top-level exception shows a visible error instead of a
// silent blank page. The bundle itself calls window.__ttlQuickVizBootLoaded()
// on successful mount, which removes the boot div.
function bootDiagnosticScript(scriptSrc: string): string {
  const escapedSrc = scriptSrc.replace(/"/g, '\\"');
  return `
      (function () {
        var boot = document.getElementById("ttl-boot");
        var loaded = false;
        function fail(label, detail) {
          if (loaded || !boot) return;
          boot.classList.add("err");
          var safe = String(detail || "(no details)").replace(/[<>&]/g, function (c) {
            return c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;";
          });
          boot.innerHTML = "<div><strong>" + label + "</strong></div><pre>" + safe + "</pre>";
        }
        window.addEventListener("error", function (e) {
          fail("Script error", (e && e.message) + " @ " + (e && e.filename) + ":" + (e && e.lineno));
        });
        window.addEventListener("unhandledrejection", function (e) {
          fail("Unhandled rejection", (e && e.reason && (e.reason.stack || e.reason.message)) || String(e && e.reason));
        });
        window.__ttlQuickVizBootLoaded = function () {
          loaded = true;
          if (boot && boot.parentNode) boot.parentNode.removeChild(boot);
        };
        setTimeout(function () {
          if (!loaded) fail(
            "Bundle did not initialize",
            "The webview script tag was injected but the bundle never called __ttlQuickVizBootLoaded(). Likely a CSP block or a top-level error before main.tsx ran. Open the webview devtools and check the console + network tab. Bundle URL: ${escapedSrc}"
          );
        }, 5000);
      })();
    `;
}

function generateNonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < 32; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
