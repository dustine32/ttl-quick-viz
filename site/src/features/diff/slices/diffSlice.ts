import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { Graph } from '@/features/graph/types';
import { setSelectedGraphId } from '@/features/graph/slices/graphSlice';
import { computeDiff, type DiffStatus } from '@/features/diff/services/computeDiff';

type SerializableDiffMap = {
  nodes: Record<string, DiffStatus>;
  edges: Record<string, DiffStatus>;
};

export type DiffState = {
  pickerOpen: boolean;
  compareSha: string | null;
  compareSubject: string | null;
  compareGraph: Graph | null;
  diffMap: SerializableDiffMap | null;
};

const initialState: DiffState = {
  pickerOpen: false,
  compareSha: null,
  compareSubject: null,
  compareGraph: null,
  diffMap: null,
};

export const diffSlice = createSlice({
  name: 'diff',
  initialState,
  reducers: {
    openPicker(state) {
      state.pickerOpen = true;
    },
    closePicker(state) {
      state.pickerOpen = false;
    },
    setCompare(
      state,
      action: PayloadAction<{
        sha: string;
        subject: string;
        compareGraph: Graph;
        currentGraph: Graph;
      }>,
    ) {
      const { sha, subject, compareGraph, currentGraph } = action.payload;
      const map = computeDiff(currentGraph, compareGraph);
      state.compareSha = sha;
      state.compareSubject = subject;
      state.compareGraph = compareGraph;
      state.diffMap = {
        nodes: Object.fromEntries(map.nodes),
        edges: Object.fromEntries(map.edges),
      };
      state.pickerOpen = false;
    },
    clearCompare(state) {
      state.compareSha = null;
      state.compareSubject = null;
      state.compareGraph = null;
      state.diffMap = null;
    },
  },
  extraReducers: (builder) => {
    // Switching graphs invalidates any active comparison — the historical
    // graphs we cached came from a different model. Reset everything.
    builder.addCase(setSelectedGraphId, (state) => {
      state.pickerOpen = false;
      state.compareSha = null;
      state.compareSubject = null;
      state.compareGraph = null;
      state.diffMap = null;
    });
  },
});

export const { openPicker, closePicker, setCompare, clearCompare } = diffSlice.actions;
export const diffReducer = diffSlice.reducer;
