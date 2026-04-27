import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type RightPanelTab = 'properties' | 'view';

export type UiState = {
  leftPanelOpen: boolean;
  rightPanelOpen: boolean;
  rightPanelTab: RightPanelTab;
  bottomPanelOpen: boolean;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  fitViewNonce: number;
  relayoutNonce: number;
  revealNonce: number;
  paletteOpen: boolean;
};

const initialState: UiState = {
  leftPanelOpen: true,
  rightPanelOpen: true,
  rightPanelTab: 'properties',
  bottomPanelOpen: false,
  selectedNodeId: null,
  selectedEdgeId: null,
  fitViewNonce: 0,
  relayoutNonce: 0,
  revealNonce: 0,
  paletteOpen: false,
};

export const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleLeftPanel(state) {
      state.leftPanelOpen = !state.leftPanelOpen;
    },
    setLeftPanelOpen(state, action: PayloadAction<boolean>) {
      state.leftPanelOpen = action.payload;
    },
    toggleRightPanel(state) {
      state.rightPanelOpen = !state.rightPanelOpen;
    },
    setRightPanelOpen(state, action: PayloadAction<boolean>) {
      state.rightPanelOpen = action.payload;
    },
    setRightPanelTab(state, action: PayloadAction<RightPanelTab>) {
      state.rightPanelTab = action.payload;
    },
    toggleBottomPanel(state) {
      state.bottomPanelOpen = !state.bottomPanelOpen;
    },
    setBottomPanelOpen(state, action: PayloadAction<boolean>) {
      state.bottomPanelOpen = action.payload;
    },
    selectNode(state, action: PayloadAction<string | null>) {
      state.selectedNodeId = action.payload;
      state.selectedEdgeId = null;
    },
    selectEdge(state, action: PayloadAction<string | null>) {
      state.selectedEdgeId = action.payload;
      state.selectedNodeId = null;
    },
    clearSelection(state) {
      state.selectedNodeId = null;
      state.selectedEdgeId = null;
    },
    requestFitView(state) {
      state.fitViewNonce += 1;
    },
    requestRelayout(state) {
      state.relayoutNonce += 1;
    },
    requestReveal(state) {
      state.revealNonce += 1;
    },
    setPaletteOpen(state, action: PayloadAction<boolean>) {
      state.paletteOpen = action.payload;
    },
    togglePalette(state) {
      state.paletteOpen = !state.paletteOpen;
    },
  },
});

export const {
  toggleLeftPanel,
  setLeftPanelOpen,
  toggleRightPanel,
  setRightPanelOpen,
  setRightPanelTab,
  toggleBottomPanel,
  setBottomPanelOpen,
  selectNode,
  selectEdge,
  clearSelection,
  requestFitView,
  requestRelayout,
  requestReveal,
  setPaletteOpen,
  togglePalette,
} = uiSlice.actions;

export const uiReducer = uiSlice.reducer;
