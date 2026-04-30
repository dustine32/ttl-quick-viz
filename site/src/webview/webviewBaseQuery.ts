import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';
import type { Graph } from '@/features/graph/types';

type GraphApiBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

// The webview has exactly one open file at a time, and the host pushes its
// data over postMessage instead of HTTP. We stash that data here so the
// SPA's RTK Query hooks (which still call /graphs/{id}, /graphs/{id}/ttl,
// etc.) can read it back without changing any renderer code.
type WebviewCache = {
  id: string;
  graph: Graph;
  ttl: string;
  fileName: string;
};

let cache: WebviewCache | undefined;

export function setWebviewGraph(payload: WebviewCache): void {
  cache = payload;
}

export function getWebviewGraph(): WebviewCache | undefined {
  return cache;
}

export const baseQuery: GraphApiBaseQuery = async (arg) => {
  const url = (typeof arg === 'string' ? arg : arg.url).replace(/^\/+/, '');

  if (url === 'graphs') {
    if (!cache) return { data: [] };
    return {
      data: [
        {
          id: cache.id,
          nodeCount: cache.graph.nodes.length,
          edgeCount: cache.graph.edges.length,
        },
      ],
    };
  }

  const graphMatch = url.match(/^graphs\/([^/]+)$/);
  if (graphMatch) {
    if (!cache || cache.id !== graphMatch[1]) {
      return { error: { status: 404, data: 'graph not loaded' } };
    }
    return { data: cache.graph };
  }

  const ttlMatch = url.match(/^graphs\/([^/]+)\/ttl$/);
  if (ttlMatch) {
    if (!cache || cache.id !== ttlMatch[1]) {
      return { error: { status: 404, data: 'ttl not loaded' } };
    }
    return { data: cache.ttl };
  }

  if (url === 'healthz') return { data: { status: 'ok' } };

  // History / diff / convert / rebuild are not supported in the webview.
  // Returning an empty/error keeps the SPA UI working without crashing.
  if (url === 'convert') return { data: { results: [], okCount: 0, errorCount: 0, skippedCount: 0 } };

  const rebuildMatch = url.match(/^graphs\/([^/]+)\/rebuild$/);
  if (rebuildMatch) {
    return {
      data: {
        id: rebuildMatch[1],
        ok: true,
        skipped: false,
        nodeCount: cache?.graph.nodes.length ?? null,
        edgeCount: cache?.graph.edges.length ?? null,
        durationMs: null,
        error: null,
      },
    };
  }

  return { error: { status: 404, data: 'not available in webview: ' + url } };
};
