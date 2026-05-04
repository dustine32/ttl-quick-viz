import knownRelations from '@/features/labels/data/known-relations.json';
import {
  addResolvedLabels,
  labelsSlice,
} from '@/features/labels/labelsSlice';

const REL_ENABLED_BY = 'http://purl.obolibrary.org/obo/RO_0002333';
const REL_PART_OF = 'http://purl.obolibrary.org/obo/BFO_0000050';
const REL_OCCURS_IN = 'http://purl.obolibrary.org/obo/BFO_0000066';
const REL_UBERON_FRAGMENT =
  'http://purl.obolibrary.org/obo/uberon/core#posteriorly_connected_to';

describe('bundled known-relations', () => {
  it('contains the GO-CAM core relations under full IRI keys', () => {
    const map = knownRelations as Record<string, string>;
    expect(map[REL_ENABLED_BY]).toBe('enabled by');
    expect(map[REL_PART_OF]).toBe('part of');
    expect(map[REL_OCCURS_IN]).toBe('occurs in');
  });

  it('routes OBO-fragment ids to expanded http://...obo/ keys', () => {
    const map = knownRelations as Record<string, string>;
    expect(map[REL_UBERON_FRAGMENT]).toBe('posteriorly connected to');
  });

  it('has no unresolved CURIE-style keys (all keys are full IRIs)', () => {
    const map = knownRelations as Record<string, string>;
    for (const key of Object.keys(map)) {
      expect(key.startsWith('http://') || key.startsWith('https://')).toBe(true);
    }
  });

  it('merges into an empty slice via addResolvedLabels', () => {
    const state = labelsSlice.reducer(
      undefined,
      addResolvedLabels(knownRelations as Record<string, string>),
    );
    expect(state.byIri[REL_ENABLED_BY]).toBe('enabled by');
    expect(Object.keys(state.byIri).length).toBeGreaterThan(700);
  });
});
