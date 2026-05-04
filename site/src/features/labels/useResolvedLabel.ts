import { useCallback } from 'react';
import { useAppSelector } from '@/app/hooks';
import { selectLabelsByIri } from '@/features/labels/selectors';

export function useResolvedLabel(iri: string, fallback?: string | null): string | undefined {
  const byIri = useAppSelector(selectLabelsByIri);
  if (fallback) return fallback;
  const hit = byIri[iri];
  return hit || undefined;
}

export type LabelResolver = (iri: string, fallback?: string | null) => string | undefined;

// Bulk variant for renderers iterating over many nodes/edges — read the map
// once, return a stable resolver that closes over it. The resolver identity
// changes only when byIri changes, so renderer useMemos depending on it stay
// cheap.
export function useLabelResolver(): LabelResolver {
  const byIri = useAppSelector(selectLabelsByIri);
  return useCallback(
    (iri, fallback) => {
      if (fallback) return fallback;
      const hit = byIri[iri];
      return hit || undefined;
    },
    [byIri],
  );
}
