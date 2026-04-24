import { graphSlice, setRenderer, setSelectedGraphId } from '@/features/graph/graphSlice';

describe('graphSlice', () => {
  it('starts with selectedGraphId = "sample" and renderer = "xyflow"', () => {
    const state = graphSlice.reducer(undefined, { type: '@@INIT' });
    expect(state.selectedGraphId).toBe('sample');
    expect(state.renderer).toBe('xyflow');
  });

  it('setSelectedGraphId updates the id', () => {
    const state = graphSlice.reducer(
      { selectedGraphId: 'sample', renderer: 'xyflow' },
      setSelectedGraphId('other'),
    );
    expect(state.selectedGraphId).toBe('other');
  });

  it('setRenderer switches the renderer', () => {
    const state = graphSlice.reducer(
      { selectedGraphId: 'sample', renderer: 'xyflow' },
      setRenderer('cytoscape'),
    );
    expect(state.renderer).toBe('cytoscape');
  });
});
