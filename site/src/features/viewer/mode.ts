// Set once at startup by the entry point. The SPA leaves it 'site' (default);
// the webview entry (`@/webview/main.tsx`) flips it to 'webview' before render
// so UI bits that don't apply (graph list, rebuild-all, share link, diff
// history) can hide themselves.
export type ViewerMode = 'site' | 'webview';

let mode: ViewerMode = 'site';

export function setViewerMode(m: ViewerMode): void {
  mode = m;
}

export function getViewerMode(): ViewerMode {
  return mode;
}

export function isWebviewMode(): boolean {
  return mode === 'webview';
}
