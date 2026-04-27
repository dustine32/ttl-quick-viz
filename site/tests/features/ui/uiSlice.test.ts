import {
  uiSlice,
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
} from '@/features/ui/uiSlice';

describe('uiSlice', () => {
  it('starts with both side panels open, bottom panel closed, properties tab, no selection', () => {
    const state = uiSlice.reducer(undefined, { type: '@@INIT' });
    expect(state.leftPanelOpen).toBe(true);
    expect(state.rightPanelOpen).toBe(true);
    expect(state.bottomPanelOpen).toBe(false);
    expect(state.rightPanelTab).toBe('properties');
    expect(state.selectedNodeId).toBeNull();
    expect(state.selectedEdgeId).toBeNull();
  });

  it('toggleBottomPanel flips the flag', () => {
    const s1 = uiSlice.reducer(undefined, toggleBottomPanel());
    expect(s1.bottomPanelOpen).toBe(true);
    const s2 = uiSlice.reducer(s1, toggleBottomPanel());
    expect(s2.bottomPanelOpen).toBe(false);
  });

  it('setBottomPanelOpen sets explicit value', () => {
    const s = uiSlice.reducer(undefined, setBottomPanelOpen(true));
    expect(s.bottomPanelOpen).toBe(true);
  });

  it('toggleLeftPanel flips the flag', () => {
    const s1 = uiSlice.reducer(undefined, toggleLeftPanel());
    expect(s1.leftPanelOpen).toBe(false);
    const s2 = uiSlice.reducer(s1, toggleLeftPanel());
    expect(s2.leftPanelOpen).toBe(true);
  });

  it('setLeftPanelOpen sets explicit value', () => {
    const s = uiSlice.reducer(undefined, setLeftPanelOpen(false));
    expect(s.leftPanelOpen).toBe(false);
  });

  it('toggleRightPanel flips the flag', () => {
    const s = uiSlice.reducer(undefined, toggleRightPanel());
    expect(s.rightPanelOpen).toBe(false);
  });

  it('setRightPanelOpen sets explicit value', () => {
    const s = uiSlice.reducer(undefined, setRightPanelOpen(false));
    expect(s.rightPanelOpen).toBe(false);
  });

  it('setRightPanelTab switches tab', () => {
    const s = uiSlice.reducer(undefined, setRightPanelTab('view'));
    expect(s.rightPanelTab).toBe('view');
  });

  it('selectNode clears edge selection', () => {
    const base = uiSlice.reducer(undefined, selectEdge('e1'));
    expect(base.selectedEdgeId).toBe('e1');
    const next = uiSlice.reducer(base, selectNode('n1'));
    expect(next.selectedNodeId).toBe('n1');
    expect(next.selectedEdgeId).toBeNull();
  });

  it('selectEdge clears node selection', () => {
    const base = uiSlice.reducer(undefined, selectNode('n1'));
    const next = uiSlice.reducer(base, selectEdge('e1'));
    expect(next.selectedEdgeId).toBe('e1');
    expect(next.selectedNodeId).toBeNull();
  });

  it('clearSelection nulls both', () => {
    const base = uiSlice.reducer(undefined, selectNode('n1'));
    const next = uiSlice.reducer(base, clearSelection());
    expect(next.selectedNodeId).toBeNull();
    expect(next.selectedEdgeId).toBeNull();
  });

  it('requestFitView increments fitViewNonce', () => {
    const s0 = uiSlice.reducer(undefined, { type: '@@INIT' });
    expect(s0.fitViewNonce).toBe(0);
    const s1 = uiSlice.reducer(s0, { type: 'ui/requestFitView' });
    expect(s1.fitViewNonce).toBe(1);
    const s2 = uiSlice.reducer(s1, { type: 'ui/requestFitView' });
    expect(s2.fitViewNonce).toBe(2);
  });

  it('requestRelayout increments relayoutNonce', () => {
    const s0 = uiSlice.reducer(undefined, { type: '@@INIT' });
    expect(s0.relayoutNonce).toBe(0);
    const s1 = uiSlice.reducer(s0, { type: 'ui/requestRelayout' });
    expect(s1.relayoutNonce).toBe(1);
  });
});
