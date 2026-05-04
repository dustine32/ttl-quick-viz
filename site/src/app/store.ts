import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { graphReducer, graphApi } from '@/features/graph';
import { uiReducer } from '@/features/ui';
import {
  STANDALONE_MODE_STORAGE_KEY,
  viewConfigReducer,
} from '@/features/view-config';
import { treeReducer } from '@/features/graph-tree/treeSlice';
import { diffReducer } from '@/features/diff';
import { LABELS_STORAGE_KEY, labelsReducer } from '@/features/labels';

export const store = configureStore({
  reducer: {
    graph: graphReducer,
    ui: uiReducer,
    viewConfig: viewConfigReducer,
    tree: treeReducer,
    diff: diffReducer,
    labels: labelsReducer,
    [graphApi.reducerPath]: graphApi.reducer,
  },
  middleware: (gDM) => gDM().concat(graphApi.middleware),
});

setupListeners(store.dispatch);

let lastPersistedStandaloneMode = store.getState().viewConfig.standaloneMode;
let lastPersistedLabels = store.getState().labels.byIri;
store.subscribe(() => {
  const state = store.getState();
  const nextStandalone = state.viewConfig.standaloneMode;
  if (nextStandalone !== lastPersistedStandaloneMode) {
    lastPersistedStandaloneMode = nextStandalone;
    try {
      window.localStorage.setItem(STANDALONE_MODE_STORAGE_KEY, nextStandalone);
    } catch {
      /* localStorage unavailable — silently skip */
    }
  }
  const nextLabels = state.labels.byIri;
  if (nextLabels !== lastPersistedLabels) {
    lastPersistedLabels = nextLabels;
    try {
      window.localStorage.setItem(LABELS_STORAGE_KEY, JSON.stringify(nextLabels));
    } catch {
      /* localStorage unavailable or quota exceeded — silently skip */
    }
  }
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
