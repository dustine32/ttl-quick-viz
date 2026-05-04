import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { addResolvedLabels } from '@/features/labels/labelsSlice';
import knownRelations from '@/features/labels/data/known-relations.json';
import metadata from '@/features/labels/data/metadata.json';

// Probes for relations + metadata bootstrap. If both are present, the merge
// is a no-op; we skip the dispatch to avoid a store-subscribe write.
const REL_PROBE = 'http://purl.obolibrary.org/obo/BFO_0000050';
const META_PROBE = 'http://geneontology.org';

// Merge bundled relation labels + GO contributor/group metadata into the
// labels slice on first mount. Idempotent.
export function useLabelsBootstrap(): void {
  const dispatch = useAppDispatch();
  const alreadyLoaded = useAppSelector(
    (s) => Boolean(s.labels.byIri[REL_PROBE]) && Boolean(s.labels.byIri[META_PROBE]),
  );
  useEffect(() => {
    if (alreadyLoaded) return;
    dispatch(
      addResolvedLabels({
        ...(knownRelations as Record<string, string>),
        ...(metadata as Record<string, string>),
      }),
    );
  }, [alreadyLoaded, dispatch]);
}
