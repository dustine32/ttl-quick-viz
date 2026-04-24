import { configureStore } from '@reduxjs/toolkit';
import { graphReducer, graphApi } from '@/features/graph';

export const store = configureStore({
  reducer: {
    graph: graphReducer,
    [graphApi.reducerPath]: graphApi.reducer,
  },
  middleware: (gDM) => gDM().concat(graphApi.middleware),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
