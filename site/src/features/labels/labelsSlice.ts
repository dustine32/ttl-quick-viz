import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type LabelsState = {
  byIri: Record<string, string>;
};

export const LABELS_STORAGE_KEY = 'ttl-quick-viz:labels:v1';

function loadByIri(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(LABELS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, string>;
    }
  } catch {
    /* localStorage unavailable or corrupt — fall through */
  }
  return {};
}

const initialState: LabelsState = {
  byIri: loadByIri(),
};

export const labelsSlice = createSlice({
  name: 'labels',
  initialState,
  reducers: {
    addResolvedLabels(state, action: PayloadAction<Record<string, string>>) {
      for (const [iri, label] of Object.entries(action.payload)) {
        state.byIri[iri] = label;
      }
    },
    clearResolvedLabels(state) {
      state.byIri = {};
    },
  },
});

export const { addResolvedLabels, clearResolvedLabels } = labelsSlice.actions;
export const labelsReducer = labelsSlice.reducer;
