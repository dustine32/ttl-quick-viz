import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { Graph, GraphSummary } from '@/features/graph/types';

export const graphApi = createApi({
  reducerPath: 'graphApi',
  baseQuery: fetchBaseQuery({ baseUrl: '/api' }),
  endpoints: (build) => ({
    getGraphs: build.query<GraphSummary[], void>({
      query: () => '/graphs',
    }),
    getGraph: build.query<Graph, string>({
      query: (id) => `/graphs/${id}`,
    }),
  }),
});

export const { useGetGraphsQuery, useGetGraphQuery } = graphApi;
