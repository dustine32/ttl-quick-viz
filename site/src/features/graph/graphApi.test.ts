import { configureStore } from '@reduxjs/toolkit';
import { graphApi } from '@/features/graph/graphApi';
import type { Graph, GraphSummary } from '@/features/graph/types';

// vitest's fetch polyfill (undici) requires absolute URLs for `new Request()`.
// Patch globalThis.Request before any RTK Query code runs so relative paths
// like `/api/graphs` are resolved against http://localhost.
const _OriginalRequest = globalThis.Request;
class _AbsoluteRequest extends _OriginalRequest {
  constructor(input: RequestInfo | URL, init?: RequestInit) {
    if (typeof input === 'string' && input.startsWith('/')) {
      super(`http://localhost${input}`, init);
    } else {
      super(input as any, init);
    }
  }
}
(globalThis as any).Request = _AbsoluteRequest;

function makeStore() {
  return configureStore({
    reducer: { [graphApi.reducerPath]: graphApi.reducer },
    middleware: (gDM) => gDM().concat(graphApi.middleware),
  });
}

describe('graphApi', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('getGraphs hits /api/graphs and returns summaries', async () => {
    const summaries: GraphSummary[] = [
      { id: 'one', nodeCount: 2, edgeCount: 1 },
    ];
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(summaries), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const store = makeStore();
    const result = await store.dispatch(
      graphApi.endpoints.getGraphs.initiate(),
    );

    const calledRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Request;
    expect(calledRequest.url).toMatch(/\/api\/graphs$/);
    expect(result.data).toEqual(summaries);
  });

  it('getGraph hits /api/graphs/:id and returns a Graph', async () => {
    const graph: Graph = {
      nodes: [{ id: 'a' }],
      edges: [],
    };
    globalThis.fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(graph), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );

    const store = makeStore();
    const result = await store.dispatch(
      graphApi.endpoints.getGraph.initiate('one'),
    );

    const calledRequest = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0] as Request;
    expect(calledRequest.url).toMatch(/\/api\/graphs\/one$/);
    expect(result.data).toEqual(graph);
  });
});
