import { createSlice, type PayloadAction } from '@reduxjs/toolkit';
import type { GraphRenderer } from '@/features/graph';

export type LabelMode = 'prefixed' | 'full' | 'label';

export type StandaloneMode = 'hide' | 'both' | 'only';

export type ViewConfigState = {
  hiddenPredicates: string[];
  hiddenTypes: string[];
  labelMode: LabelMode;
  layoutAlgoXyflow: string;
  layoutAlgoCytoscape: string;
  focusNodeId: string | null;
  focusDepth: number;
  revealedNodeIds: string[];
  pinnedNodeIds: string[];
  sizeByDegree: boolean;
  standaloneMode: StandaloneMode;
  minDegree: number;
  swimlaneMaxLanes: number;
  swimlaneGroupBy: SwimlaneGroupBy;
  swimlaneSubGroupBy: SwimlaneSubGroupBy;
  swimlaneHideOther: boolean;
};

export type SwimlaneGroupBy = 'component' | 'type';
export type SwimlaneSubGroupBy = 'none' | 'type' | 'component';

export const STANDALONE_MODE_STORAGE_KEY = 'ttl-quick-viz:standaloneMode';

function loadStandaloneMode(): StandaloneMode {
  try {
    const raw = window.localStorage.getItem(STANDALONE_MODE_STORAGE_KEY);
    if (raw === 'hide' || raw === 'both' || raw === 'only') return raw;
  } catch {
    /* localStorage unavailable (SSR, privacy mode) — fall through */
  }
  return 'both';
}

const initialState: ViewConfigState = {
  hiddenPredicates: [],
  hiddenTypes: [],
  labelMode: 'prefixed',
  layoutAlgoXyflow: 'layered',
  layoutAlgoCytoscape: 'breadthfirst',
  focusNodeId: null,
  focusDepth: 2,
  revealedNodeIds: [],
  pinnedNodeIds: [],
  sizeByDegree: false,
  standaloneMode: loadStandaloneMode(),
  minDegree: 0,
  swimlaneMaxLanes: 8,
  swimlaneGroupBy: 'component',
  swimlaneSubGroupBy: 'none',
  swimlaneHideOther: false,
};

function toggleInArray(arr: string[], value: string): string[] {
  return arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value];
}

export const viewConfigSlice = createSlice({
  name: 'viewConfig',
  initialState,
  reducers: {
    togglePredicateHidden(state, action: PayloadAction<string>) {
      state.hiddenPredicates = toggleInArray(state.hiddenPredicates, action.payload);
    },
    setHiddenPredicates(state, action: PayloadAction<string[]>) {
      state.hiddenPredicates = action.payload;
    },
    toggleTypeHidden(state, action: PayloadAction<string>) {
      state.hiddenTypes = toggleInArray(state.hiddenTypes, action.payload);
    },
    setHiddenTypes(state, action: PayloadAction<string[]>) {
      state.hiddenTypes = action.payload;
    },
    setLabelMode(state, action: PayloadAction<LabelMode>) {
      state.labelMode = action.payload;
    },
    setLayoutAlgo(
      state,
      action: PayloadAction<{ renderer: GraphRenderer; algo: string }>,
    ) {
      if (action.payload.renderer === 'xyflow') {
        state.layoutAlgoXyflow = action.payload.algo;
      } else if (action.payload.renderer === 'cytoscape') {
        state.layoutAlgoCytoscape = action.payload.algo;
      }
    },
    setFocusNodeId(state, action: PayloadAction<string | null>) {
      state.focusNodeId = action.payload;
      state.revealedNodeIds = [];
    },
    setFocusDepth(state, action: PayloadAction<number>) {
      state.focusDepth = Math.max(0, Math.min(10, action.payload));
    },
    clearFocus(state) {
      state.focusNodeId = null;
      state.revealedNodeIds = [];
    },
    revealNode(state, action: PayloadAction<string>) {
      if (!state.revealedNodeIds.includes(action.payload)) {
        state.revealedNodeIds.push(action.payload);
      }
    },
    togglePinned(state, action: PayloadAction<string>) {
      state.pinnedNodeIds = toggleInArray(state.pinnedNodeIds, action.payload);
    },
    setSizeByDegree(state, action: PayloadAction<boolean>) {
      state.sizeByDegree = action.payload;
    },
    setStandaloneMode(state, action: PayloadAction<StandaloneMode>) {
      state.standaloneMode = action.payload;
    },
    setMinDegree(state, action: PayloadAction<number>) {
      state.minDegree = Math.max(0, Math.min(20, Math.floor(action.payload)));
    },
    setSwimlaneMaxLanes(state, action: PayloadAction<number>) {
      state.swimlaneMaxLanes = Math.max(1, Math.min(20, Math.floor(action.payload)));
    },
    setSwimlaneGroupBy(state, action: PayloadAction<SwimlaneGroupBy>) {
      state.swimlaneGroupBy = action.payload;
    },
    setSwimlaneSubGroupBy(state, action: PayloadAction<SwimlaneSubGroupBy>) {
      state.swimlaneSubGroupBy = action.payload;
    },
    setSwimlaneHideOther(state, action: PayloadAction<boolean>) {
      state.swimlaneHideOther = action.payload;
    },
    resetView() {
      return initialState;
    },
  },
});

export const {
  togglePredicateHidden,
  setHiddenPredicates,
  toggleTypeHidden,
  setHiddenTypes,
  setLabelMode,
  setLayoutAlgo,
  setFocusNodeId,
  setFocusDepth,
  clearFocus,
  revealNode,
  togglePinned,
  setSizeByDegree,
  setStandaloneMode,
  setMinDegree,
  setSwimlaneMaxLanes,
  setSwimlaneGroupBy,
  setSwimlaneSubGroupBy,
  setSwimlaneHideOther,
  resetView,
} = viewConfigSlice.actions;

export const viewConfigReducer = viewConfigSlice.reducer;
