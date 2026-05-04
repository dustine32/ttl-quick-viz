import { GO_CONTEXT, SORTED_PREFIX_ENTRIES } from '@/features/labels/data/prefix-map';

export function iriToCurie(iri: string): string | null {
  if (!iri || iri.startsWith('_:')) return null;
  for (const [prefix, namespace] of SORTED_PREFIX_ENTRIES) {
    if (iri.startsWith(namespace) && iri.length > namespace.length) {
      return prefix + ':' + iri.slice(namespace.length);
    }
  }
  return null;
}

export function curieToIri(curie: string): string | null {
  if (!curie) return null;
  const colonIdx = curie.indexOf(':');
  if (colonIdx <= 0) return null;
  const prefix = curie.slice(0, colonIdx);
  const local = curie.slice(colonIdx + 1);
  const namespace = GO_CONTEXT[prefix];
  if (!namespace) return null;
  return namespace + local;
}
