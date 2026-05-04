import { useCallback } from 'react';
import { useAppSelector } from '@/app/hooks';
import { GO_CONTEXT } from '@/features/labels/data/prefix-map';
import { selectLabelsByIri } from '@/features/labels/selectors';
import { formatIri, type PrefixRegistry } from '@/features/view-config/prefixes';
import type { LabelMode } from '@/features/view-config/viewConfigSlice';

export type FormatIriFn = (
  iri: string,
  mode: LabelMode,
  options?: { label?: string | null; prefixes?: PrefixRegistry },
) => string;

// Drop-in replacement for `formatIri` that:
//   1. Consults the labels cache when the caller doesn't supply a wire label
//      (wire labels still win — they came straight from the TTL's rdfs:label).
//   2. Uses the full GO @context prefix map for IRI shortening, so model-
//      internal IRIs like `http://model.geneontology.org/<id>` collapse to
//      `gomodel:<id>` instead of being rendered as the full URL.
export function useFormatIri(): FormatIriFn {
  const byIri = useAppSelector(selectLabelsByIri);
  return useCallback(
    (iri, mode, options = {}) => {
      const merged = { prefixes: GO_CONTEXT, ...options };
      const wireLabel = options.label;
      if (wireLabel) {
        return formatIri(iri, mode, merged);
      }
      const cached = byIri[iri];
      if (cached) {
        return formatIri(iri, mode, { ...merged, label: cached });
      }
      return formatIri(iri, mode, merged);
    },
    [byIri],
  );
}
