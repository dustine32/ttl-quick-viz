import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

type GraphUiState = {
  selectedGraphId: string;
};

const initialState: GraphUiState = {
  selectedGraphId: 'sample',
};

export const graphSlice = createSlice({
  name: 'graph',
  initialState,
  reducers: {
    setSelectedGraphId(state, action: PayloadAction<string>) {
      state.selectedGraphId = action.payload;
    },
  },
});

export const { setSelectedGraphId } = graphSlice.actions;
export const graphReducer = graphSlice.reducer;
