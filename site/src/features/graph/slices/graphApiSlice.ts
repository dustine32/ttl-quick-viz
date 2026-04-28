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

export type HistoryEntry = {
  sha: string;
  subject: string;
  date: string;
  graph: Graph;
};

export const graphApi = createApi({
  reducerPath: 'graphApi',
  baseQuery: fetchBaseQuery({ baseUrl: import.meta.env.VITE_API_URL }),
  tagTypes: ['Graphs', 'Graph', 'GraphTtl', 'GraphTtlHistorical', 'GraphHistory'],
  refetchOnFocus: true,
  refetchOnReconnect: true,
  endpoints: (build) => ({
    getHealth: build.query<{ status: string }, void>({
      query: () => '/healthz',
    }),
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
    getGraphTtl: build.query<string, string>({
      query: (id) => ({
        url: `/graphs/${id}/ttl`,
        responseHandler: (response) => response.text(),
      }),
      providesTags: (_result, _err, id) => [{ type: 'GraphTtl' as const, id }],
    }),
    getGraphHistory: build.query<HistoryEntry[], { id: string; n?: number }>({
      query: ({ id, n }) => ({
        url: `/graphs/${id}/history`,
        params: n != null ? { n } : undefined,
      }),
      providesTags: (_result, _err, { id }) => [{ type: 'GraphHistory' as const, id }],
    }),
    getGraphTtlAt: build.query<string, { id: string; sha: string }>({
      query: ({ id, sha }) => ({
        url: `/graphs/${id}/ttl/at/${sha}`,
        responseHandler: (response) => response.text(),
      }),
      providesTags: (_result, _err, { id, sha }) => [
        { type: 'GraphTtlHistorical' as const, id: `${id}@${sha}` },
      ],
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
        { type: 'GraphTtl', id },
        { type: 'Graphs', id: 'LIST' },
      ],
    }),
  }),
});

export const {
  useGetHealthQuery,
  useGetGraphsQuery,
  useGetGraphQuery,
  useGetGraphTtlQuery,
  useGetGraphTtlAtQuery,
  useGetGraphHistoryQuery,
  useConvertAllMutation,
  useRebuildGraphMutation,
} = graphApi;
