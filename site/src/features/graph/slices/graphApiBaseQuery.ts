import { fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import type { BaseQueryFn, FetchArgs, FetchBaseQueryError } from '@reduxjs/toolkit/query';

export type GraphApiBaseQuery = BaseQueryFn<string | FetchArgs, unknown, FetchBaseQueryError>;

export const baseQuery: GraphApiBaseQuery = fetchBaseQuery({
  baseUrl: import.meta.env.VITE_API_URL,
});
