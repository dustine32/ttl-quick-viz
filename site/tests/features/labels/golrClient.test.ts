import { afterEach, beforeEach, vi } from 'vitest';
import { resolveLabels } from '@/features/labels/golrClient';

const REL_ENABLED_BY = 'http://purl.obolibrary.org/obo/RO_0002333';
const GO_MF = 'http://purl.obolibrary.org/obo/GO_0003674';
const GOMODEL_INTERNAL = 'http://model.geneontology.org/foo';
const UNKNOWN = 'http://example.org/x/123';

const jsonpMock = vi.fn();

vi.mock('@/features/labels/jsonpRequest', () => ({
  jsonpRequest: (url: string) => jsonpMock(url),
}));

beforeEach(() => {
  jsonpMock.mockReset();
});

afterEach(() => {
  vi.restoreAllMocks();
});

function mockResponse(
  docs: Array<{ annotation_class: string; annotation_class_label: string }>,
) {
  return { response: { docs } };
}

describe('resolveLabels (JSONP)', () => {
  it('skips IRIs with unknown prefix and gomodel: internals', async () => {
    jsonpMock.mockResolvedValueOnce(
      mockResponse([
        { annotation_class: 'RO:0002333', annotation_class_label: 'enabled by' },
      ]),
    );
    const result = await resolveLabels([REL_ENABLED_BY, GOMODEL_INTERNAL, UNKNOWN]);
    expect(jsonpMock).toHaveBeenCalledTimes(1);
    expect(result.requestedCount).toBe(1);
    expect(result.resolvedCount).toBe(1);
    expect(result.byIri[REL_ENABLED_BY]).toBe('enabled by');
  });

  it('builds q with field-repeated OR clauses and a document_category fq', async () => {
    jsonpMock.mockResolvedValueOnce(mockResponse([]));
    await resolveLabels([REL_ENABLED_BY, GO_MF]);
    const url = jsonpMock.mock.calls[0][0] as string;
    const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
    expect(decoded).toContain(
      'q=annotation_class:"RO:0002333" OR annotation_class:"GO:0003674"',
    );
    expect(decoded).toContain('fq=document_category:"ontology_class"');
    expect(decoded).toContain('wt=json');
  });

  it('reports failed chunks and surfaces the last error when JSONP fails', async () => {
    jsonpMock.mockRejectedValueOnce(new Error('script load failed'));
    const result = await resolveLabels([REL_ENABLED_BY]);
    expect(result.resolvedCount).toBe(0);
    expect(Object.keys(result.byIri)).toHaveLength(0);
    expect(result.failedChunks).toBe(1);
    expect(result.totalChunks).toBe(1);
    expect(result.lastError).toContain('script load failed');
  });

  it('chunks > 80 IRIs into multiple requests', async () => {
    const iris = Array.from(
      { length: 200 },
      (_, i) => 'http://purl.obolibrary.org/obo/GO_' + String(i).padStart(7, '0'),
    );
    jsonpMock.mockResolvedValue(mockResponse([]));
    await resolveLabels(iris);
    expect(jsonpMock).toHaveBeenCalledTimes(3);
  });

  it('deduplicates IRIs before sending', async () => {
    jsonpMock.mockResolvedValueOnce(mockResponse([]));
    await resolveLabels([REL_ENABLED_BY, REL_ENABLED_BY, REL_ENABLED_BY]);
    const url = jsonpMock.mock.calls[0][0] as string;
    const decoded = decodeURIComponent(url).replace(/\+/g, ' ');
    const matches = decoded.match(/RO:0002333/g) ?? [];
    expect(matches).toHaveLength(1);
  });
});
