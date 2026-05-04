import { selectResolvedLabel } from '@/features/labels/selectors';
import type { RootState } from '@/app/store';

function makeState(byIri: Record<string, string>): RootState {
  return { labels: { byIri } } as unknown as RootState;
}

describe('selectResolvedLabel', () => {
  const state = makeState({
    'http://purl.obolibrary.org/obo/RO_0002333': 'enabled by',
  });

  it('returns the wire fallback when present', () => {
    expect(
      selectResolvedLabel(state, 'http://purl.obolibrary.org/obo/RO_0002333', 'wire-label'),
    ).toBe('wire-label');
  });

  it('returns the cached label when no fallback is given', () => {
    expect(selectResolvedLabel(state, 'http://purl.obolibrary.org/obo/RO_0002333')).toBe(
      'enabled by',
    );
  });

  it('returns undefined when neither fallback nor cache has a label', () => {
    expect(selectResolvedLabel(state, 'http://purl.obolibrary.org/obo/UNKNOWN_1')).toBeUndefined();
  });

  it('treats empty-string fallback as missing (falls through to cache)', () => {
    expect(
      selectResolvedLabel(state, 'http://purl.obolibrary.org/obo/RO_0002333', ''),
    ).toBe('enabled by');
  });
});
