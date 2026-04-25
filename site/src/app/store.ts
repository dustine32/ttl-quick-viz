import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { graphReducer, graphApi } from '@/features/graph';
import { uiReducer } from '@/features/ui';
import { viewConfigReducer } from '@/features/view-config';

export const store = configureStore({
  reducer: {
    graph: graphReducer,
    ui: uiReducer,
    viewConfig: viewConfigReducer,
    [graphApi.reducerPath]: graphApi.reducer,
  },
  middleware: (gDM) => gDM().concat(graphApi.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
