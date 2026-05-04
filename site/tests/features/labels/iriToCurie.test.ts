import { curieToIri, iriToCurie } from '@/features/labels/iriToCurie';

describe('iriToCurie', () => {
  it('expands obo class IRIs to canonical CURIEs (longest match wins)', () => {
    expect(iriToCurie('http://purl.obolibrary.org/obo/GO_0003674')).toBe('GO:0003674');
    expect(iriToCurie('http://purl.obolibrary.org/obo/RO_0002333')).toBe('RO:0002333');
    expect(iriToCurie('http://purl.obolibrary.org/obo/CHEBI_15377')).toBe('CHEBI:15377');
    expect(iriToCurie('http://purl.obolibrary.org/obo/UBERON_0000105')).toBe('UBERON:0000105');
  });

  it('falls back to obo: for OBO IRIs with no specific prefix entry', () => {
    expect(iriToCurie('http://purl.obolibrary.org/obo/uberon/core#posteriorly_connected_to'))
      .toBe('obo:uberon/core#posteriorly_connected_to');
  });

  it('returns null for unknown IRI prefixes', () => {
    expect(iriToCurie('http://example.org/some/thing')).toBeNull();
    expect(iriToCurie('https://example.org/x')).toBeNull();
  });

  it('returns null for blank node placeholders and empty input', () => {
    expect(iriToCurie('_:b1')).toBeNull();
    expect(iriToCurie('')).toBeNull();
  });

  it('does not match a namespace exactly (no empty-suffix CURIE)', () => {
    // The "GO" namespace is exactly this IRI; the obo: prefix still matches
    // with suffix "GO_", which is a valid (if odd) CURIE for the IRI.
    expect(iriToCurie('http://purl.obolibrary.org/obo/GO_')).toBe('obo:GO_');
    expect(iriToCurie('http://purl.obolibrary.org/obo/')).toBeNull();
  });
});

describe('curieToIri', () => {
  it('expands canonical CURIEs to full IRIs', () => {
    expect(curieToIri('GO:0003674')).toBe('http://purl.obolibrary.org/obo/GO_0003674');
    expect(curieToIri('RO:0002333')).toBe('http://purl.obolibrary.org/obo/RO_0002333');
    expect(curieToIri('BFO:0000050')).toBe('http://purl.obolibrary.org/obo/BFO_0000050');
  });

  it('round-trips through iriToCurie for known prefixes', () => {
    const samples = [
      'http://purl.obolibrary.org/obo/GO_0003674',
      'http://purl.obolibrary.org/obo/RO_0002333',
      'http://purl.obolibrary.org/obo/CL_0000003',
      'http://purl.obolibrary.org/obo/CHEBI_15377',
    ];
    for (const iri of samples) {
      const curie = iriToCurie(iri);
      expect(curie).not.toBeNull();
      expect(curieToIri(curie as string)).toBe(iri);
    }
  });

  it('returns null for unknown prefixes', () => {
    expect(curieToIri('XYZ:0000001')).toBeNull();
    expect(curieToIri('')).toBeNull();
    expect(curieToIri(':0000001')).toBeNull();
    expect(curieToIri('NOCOLON')).toBeNull();
  });
});
