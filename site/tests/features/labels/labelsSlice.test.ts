import {
  addResolvedLabels,
  clearResolvedLabels,
  labelsSlice,
} from '@/features/labels/labelsSlice';

describe('labelsSlice', () => {
  it('starts with an empty byIri map', () => {
    const state = labelsSlice.reducer(undefined, { type: '@@INIT' });
    expect(state.byIri).toEqual({});
  });

  it('addResolvedLabels merges entries, last-write-wins on conflict', () => {
    const s1 = labelsSlice.reducer(
      { byIri: {} },
      addResolvedLabels({
        'http://purl.obolibrary.org/obo/RO_0002333': 'enabled by',
        'http://purl.obolibrary.org/obo/BFO_0000050': 'part of',
      }),
    );
    expect(Object.keys(s1.byIri)).toHaveLength(2);
    expect(s1.byIri['http://purl.obolibrary.org/obo/RO_0002333']).toBe('enabled by');

    const s2 = labelsSlice.reducer(
      s1,
      addResolvedLabels({
        'http://purl.obolibrary.org/obo/RO_0002333': 'enabled-by',
        'http://purl.obolibrary.org/obo/GO_0003674': 'molecular function',
      }),
    );
    expect(Object.keys(s2.byIri)).toHaveLength(3);
    expect(s2.byIri['http://purl.obolibrary.org/obo/RO_0002333']).toBe('enabled-by');
    expect(s2.byIri['http://purl.obolibrary.org/obo/BFO_0000050']).toBe('part of');
  });

  it('clearResolvedLabels empties the map', () => {
    const s1 = labelsSlice.reducer(
      { byIri: { 'http://purl.obolibrary.org/obo/RO_0002333': 'enabled by' } },
      clearResolvedLabels(),
    );
    expect(s1.byIri).toEqual({});
  });
});
