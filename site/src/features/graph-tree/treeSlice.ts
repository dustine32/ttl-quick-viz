import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';

export type TreeOrientation = 'DOWN' | 'RIGHT';

export type TreeState = {
  collapsedIds: string[];
  orientation: TreeOrientation;
};

const initialState: TreeState = {
  collapsedIds: [],
  orientation: 'DOWN',
};

export const treeSlice = createSlice({
  name: 'tree',
  initialState,
  reducers: {
    toggleCollapsed(state, action: PayloadAction<string>) {
      const id = action.payload;
      const idx = state.collapsedIds.indexOf(id);
      if (idx >= 0) state.collapsedIds.splice(idx, 1);
      else state.collapsedIds.push(id);
    },
    expandAll(state) {
      state.collapsedIds = [];
    },
    setOrientation(state, action: PayloadAction<TreeOrientation>) {
      state.orientation = action.payload;
    },
  },
});

export const { toggleCollapsed, expandAll, setOrientation } = treeSlice.actions;
export const treeReducer = treeSlice.reducer;

export const selectTreeState = (state: RootState) => state.tree;

export const selectCollapsedIds = createSelector(
  selectTreeState,
  (t) => new Set(t.collapsedIds),
);

export const selectTreeOrientation = (state: RootState) => state.tree.orientation;
