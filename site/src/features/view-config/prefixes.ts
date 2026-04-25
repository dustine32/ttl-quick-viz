import type { LabelMode } from '@/features/view-config/viewConfigSlice';

export type PrefixRegistry = Record<string, string>;

export const DEFAULT_PREFIXES: PrefixRegistry = {
  rdf: 'http://www.w3.org/1999/02/22-rdf-syntax-ns#',
  rdfs: 'http://www.w3.org/2000/01/rdf-schema#',
  owl: 'http://www.w3.org/2002/07/owl#',
  xsd: 'http://www.w3.org/2001/XMLSchema#',
  foaf: 'http://xmlns.com/foaf/0.1/',
  dc: 'http://purl.org/dc/elements/1.1/',
  dcterms: 'http://purl.org/dc/terms/',
  skos: 'http://www.w3.org/2004/02/skos/core#',
  schema: 'http://schema.org/',
  obo: 'http://purl.obolibrary.org/obo/',
};

export function shortenIri(value: string): string {
  if (!value) return value;
  const hashIdx = value.lastIndexOf('#');
  if (hashIdx >= 0 && hashIdx < value.length - 1) return value.slice(hashIdx + 1);
  const slashIdx = value.lastIndexOf('/');
  if (slashIdx >= 0 && slashIdx < value.length - 1) return value.slice(slashIdx + 1);
  return value;
}

export function toPrefixed(iri: string, prefixes: PrefixRegistry = DEFAULT_PREFIXES): string {
  for (const [prefix, namespace] of Object.entries(prefixes)) {
    if (iri.startsWith(namespace) && iri.length > namespace.length) {
      return `${prefix}:${iri.slice(namespace.length)}`;
    }
  }
  return shortenIri(iri);
}

export function formatIri(
  iri: string,
  mode: LabelMode,
  options: { label?: string | null; prefixes?: PrefixRegistry } = {},
): string {
  const { label, prefixes = DEFAULT_PREFIXES } = options;
  if (mode === 'full') return iri;
  if (mode === 'label' && label) return label;
  return toPrefixed(iri, prefixes);
}
