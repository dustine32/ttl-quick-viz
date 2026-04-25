import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Graph, GraphSummary } from '@/features/graph/types';

export type GraphConversionResult = {
  id: string;
  ok: boolean;
  skipped: boolean;
  nodeCount: number | null;
  edgeCount: number | null;
  durationMs: number | null;
  error: string | null;
};

export type ConvertResponse = {
  results: GraphConversionResult[];
  okCount: number;
  errorCount: number;
  skippedCount: number;
};

export const graphApi = createApi({
  reducerPath: 'graphApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  tagTypes: ['Graphs', 'Graph'],
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (build) => ({
    getGraphs: build.query<GraphSummary[], void>({
      query: () => '/graphs',
      providesTags: (result) =>
        result
          ? [
              ...result.map(({ id }) => ({ type: 'Graph' as const, id })),
              { type: 'Graphs' as const, id: 'LIST' },
            ]
          : [{ type: 'Graphs' as const, id: 'LIST' }],
    }),
    getGraph: build.query<Graph, string>({
      query: (id) => `/graphs/${id}`,
      providesTags: (_result, _err, id) => [{ type: 'Graph' as const, id }],
    }),
    convertAll: build.mutation<ConvertResponse, { force?: boolean } | void>({
      query: (arg) => ({
        url: '/convert',
        method: 'POST',
        params: arg?.force ? { force: true } : undefined,
      }),
      invalidatesTags: [{ type: 'Graphs', id: 'LIST' }],
    }),
    rebuildGraph: build.mutation<GraphConversionResult, { id: string; force?: boolean }>({
      query: ({ id, force }) => ({
        url: `/graphs/${id}/rebuild`,
        method: 'POST',
        params: force === false ? { force: false } : undefined,
      }),
      invalidatesTags: (_result, _err, { id }) => [
        { type: 'Graph', id },
        { type: 'Graphs', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetGraphsQuery,
  useGetGraphQuery,
  useConvertAllMutation,
  useRebuildGraphMutation,
} = graphApi;
