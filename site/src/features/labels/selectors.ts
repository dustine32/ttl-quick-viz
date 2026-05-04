import type { RootState } from '@/app/store';

export function selectLabelsByIri(state: RootState): Record<string, string> {
  return state.labels.byIri;
}

export function selectResolvedLabel(
  state: RootState,
  iri: string,
  fallback?: string | null,
): string | undefined {
  if (fallback) return fallback;
  const hit = state.labels.byIri[iri];
  return hit || undefined;
}
