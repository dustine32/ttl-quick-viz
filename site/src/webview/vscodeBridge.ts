type VsCodeApi = {
  postMessage: (msg: unknown) => void;
};

declare global {
  interface Window {
    acquireVsCodeApi?: () => VsCodeApi;
  }
}

let api: VsCodeApi | undefined;

export function getVsCodeApi(): VsCodeApi | undefined {
  if (api) return api;
  if (typeof window !== 'undefined' && typeof window.acquireVsCodeApi === 'function') {
    api = window.acquireVsCodeApi();
  }
  return api;
}

export function postToHost(msg: unknown): void {
  const a = getVsCodeApi();
  if (!a) return;
  a.postMessage(msg);
}
