import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { graphReducer, graphApi } from '@/features/graph';
import { uiReducer } from '@/features/ui';
import {
  STANDALONE_MODE_STORAGE_KEY,
  viewConfigReducer,
} from '@/features/view-config';
import { treeReducer } from '@/features/graph-tree/treeSlice';

export const store = configureStore({
  reducer: {
    graph: graphReducer,
    ui: uiReducer,
    viewConfig: viewConfigReducer,
    tree: treeReducer,
    [graphApi.reducerPath]: graphApi.reducer,
  },
  middleware: (gDM) => gDM().concat(graphApi.middleware),
});

setupListeners(store.dispatch);

let lastPersistedStandaloneMode = store.getState().viewConfig.standaloneMode;
store.subscribe(() => {
  const next = store.getState().viewConfig.standaloneMode;
  if (next === lastPersistedStandaloneMode) return;
  lastPersistedStandaloneMode = next;
  try {
    window.localStorage.setItem(STANDALONE_MODE_STORAGE_KEY, next);
  } catch {
    /* localStorage unavailable — silently skip */
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
