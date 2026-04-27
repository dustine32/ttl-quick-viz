import { createSelector } from '@reduxjs/toolkit';
import type { RootState } from '@/app/store';

export const selectViewConfig = (state: RootState) => state.viewConfig;

export const selectHiddenPredicates = createSelector(
  selectViewConfig,
  (v) => new Set(v.hiddenPredicates),
);

export const selectHiddenTypes = createSelector(
  selectViewConfig,
  (v) => new Set(v.hiddenTypes),
);

export const selectLabelMode = (state: RootState) => state.viewConfig.labelMode;

export const selectFocusNodeId = (state: RootState) => state.viewConfig.focusNodeId;
export const selectFocusDepth = (state: RootState) => state.viewConfig.focusDepth;

export const selectRevealedNodeIds = createSelector(
  selectViewConfig,
  (v) => new Set(v.revealedNodeIds),
);

export const selectPinnedNodeIds = createSelector(
  selectViewConfig,
  (v) => new Set(v.pinnedNodeIds),
);

export const selectSizeByDegree = (state: RootState) => state.viewConfig.sizeByDegree;

export const selectStandaloneMode = (state: RootState) =>
  state.viewConfig.standaloneMode;
export const selectMinDegree = (state: RootState) => state.viewConfig.minDegree;

export const selectLayoutAlgoXyflow = (state: RootState) =>
  state.viewConfig.layoutAlgoXyflow;
export const selectLayoutAlgoCytoscape = (state: RootState) =>
  state.viewConfig.layoutAlgoCytoscape;

export const selectSwimlaneMaxLanes = (state: RootState) =>
  state.viewConfig.swimlaneMaxLanes;
export const selectSwimlaneGroupBy = (state: RootState) =>
  state.viewConfig.swimlaneGroupBy;
export const selectSwimlaneSubGroupBy = (state: RootState) =>
  state.viewConfig.swimlaneSubGroupBy;
export const selectSwimlaneHideOther = (state: RootState) =>
  state.viewConfig.swimlaneHideOther;
