import { configureStore } from '@reduxjs/toolkit';
import { graphApi } from '@/features/graph/graphApi';
import type { Graph, GraphSummary } from '@/features/graph/types';

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

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])
      .toMatch(/\/api\/graphs$/);
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

    expect((globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0])
      .toMatch(/\/api\/graphs\/one$/);
    expect(result.data).toEqual(graph);
  });
});
