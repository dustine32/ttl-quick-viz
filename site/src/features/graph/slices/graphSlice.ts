import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type GraphRenderer =
  | 'xyflow'
  | 'cytoscape'
  | 'force'
  | 'force3d'
  | 'sigma'
  | 'graphin'
  | 'tree';

type GraphUiState = {
  selectedGraphId: string;
  renderer: GraphRenderer;
};

const initialState: GraphUiState = {
  selectedGraphId: '',
  renderer: 'xyflow',
};

export const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setSelectedGraphId(state, action: PayloadAction<string>) {
      state.selectedGraphId = action.payload;
    },
    setRenderer(state, action: PayloadAction<GraphRenderer>) {
      state.renderer = action.payload;
    },
  },
});

export const { setSelectedGraphId, setRenderer } = graphSlice.actions;
export const graphReducer = graphSlice.reducer;
