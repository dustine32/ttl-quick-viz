import { graphSlice, setSelectedGraphId } from '@/features/graph/graphSlice';

describe('graphSlice', () => {
  it('starts with selectedGraphId = "sample"', () => {
    const state = graphSlice.reducer(undefined, { type: '@@INIT' });
    expect(state.selectedGraphId).toBe('sample');
  });

  it('setSelectedGraphId updates the id', () => {
    const state = graphSlice.reducer(
      { selectedGraphId: 'sample' },
      setSelectedGraphId('other'),
    );
    expect(state.selectedGraphId).toBe('other');
  });
});
