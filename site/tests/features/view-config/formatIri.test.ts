import { formatIri } from '@/features/view-config/prefixes';

const GO_MF = 'http://purl.obolibrary.org/obo/GO_0003674';
const ZFIN = 'http://identifiers.org/zfin/ZDB-GENE-000210-31';

describe('formatIri', () => {
  it('label mode shows the label, falls back to prefixed when missing', () => {
    expect(formatIri(GO_MF, 'label', { label: 'molecular function' })).toBe(
      'molecular function',
    );
    // No label → falls back to whatever toPrefixed returns (obo:GO_0003674
    // under the small DEFAULT_PREFIXES used by formatIri).
    expect(formatIri(GO_MF, 'label')).toBe('obo:GO_0003674');
  });

  it('prefixed mode returns the CURIE form, ignoring labels', () => {
    expect(formatIri(GO_MF, 'prefixed', { label: 'molecular function' })).toBe(
      'obo:GO_0003674',
    );
  });

  it('full mode returns the raw IRI, ignoring labels', () => {
    expect(formatIri(GO_MF, 'full', { label: 'molecular function' })).toBe(GO_MF);
  });

  it('label-id mode renders "label (id)" when label is present', () => {
    expect(formatIri(GO_MF, 'label-id', { label: 'molecular function' })).toBe(
      'molecular function (obo:GO_0003674)',
    );
  });

  it('label-id mode falls back to id-only when no label is available', () => {
    expect(formatIri(GO_MF, 'label-id')).toBe('obo:GO_0003674');
  });

  it('id-label mode renders "id (label)" when label is present', () => {
    expect(formatIri(GO_MF, 'id-label', { label: 'molecular function' })).toBe(
      'obo:GO_0003674 (molecular function)',
    );
  });

  it('id-label mode falls back to id-only when no label is available', () => {
    expect(formatIri(GO_MF, 'id-label')).toBe('obo:GO_0003674');
  });

  it('label-full mode renders "label (fullIri)" when label is present', () => {
    expect(formatIri(GO_MF, 'label-full', { label: 'molecular function' })).toBe(
      'molecular function (' + GO_MF + ')',
    );
  });

  it('label-full mode falls back to the full IRI when no label is available', () => {
    expect(formatIri(GO_MF, 'label-full')).toBe(GO_MF);
  });

  it('handles IRIs with no known prefix by returning the IRI tail', () => {
    expect(formatIri(ZFIN, 'prefixed')).toBe('ZDB-GENE-000210-31');
    expect(formatIri(ZFIN, 'label-id', { label: 'some gene' })).toBe(
      'some gene (ZDB-GENE-000210-31)',
    );
  });
});
