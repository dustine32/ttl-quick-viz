import { curieToIri, iriToCurie } from '@/features/labels/iriToCurie';
import { jsonpRequest } from '@/features/labels/jsonpRequest';

// noctua-golr.berkeleybop.org is HTTP-only — its 443 port times out.
// This means: (a) JSONP via <script> is required (no CORS on HTTP either),
// and (b) the dev/site origin must also be HTTP, otherwise the browser
// blocks the load as mixed content. Vite dev defaults to http://localhost
// so this is fine.
const GOLR_URL = 'http://noctua-golr.berkeleybop.org/select';
const CHUNK_SIZE = 80;
const MAX_CONCURRENCY = 4;

// Prefixes that point at noctua/GO-CAM model internals — never live in
// GOlr. Skip them up front so we don't waste round-trips.
const SKIP_CURIE_PREFIXES = new Set(['gomodel']);

export type ResolveResult = {
  byIri: Record<string, string>;
  requestedCount: number;
  resolvedCount: number;
  failedChunks: number;
  totalChunks: number;
  lastError?: string;
};

type GolrDoc = {
  annotation_class?: string;
  annotation_class_label?: string;
};

type GolrResponse = {
  response?: {
    docs?: GolrDoc[];
  };
};

function buildUrl(curieChunk: string[]): string {
  const params = new URLSearchParams();
  // Default lucene parser. edismax + q=*:* doesn't combine cleanly here.
  // Field-repeated OR clauses (annotation_class:"X" OR annotation_class:"Y")
  // is the form noctua-form-base-rt uses for closure filters; the
  // parenthetical shorthand `annotation_class:("X" OR "Y")` was getting
  // rejected.
  params.set('wt', 'json');
  params.set('indent', 'on');
  params.set('rows', String(curieChunk.length + 5));
  params.set('start', '0');
  params.append('fl', 'annotation_class,annotation_class_label');
  params.append('fq', 'document_category:"ontology_class"');
  const qClause = curieChunk
    .map((c) => 'annotation_class:"' + c + '"')
    .join(' OR ');
  params.set('q', qClause);
  return GOLR_URL + '?' + params.toString();
}

type ChunkResult =
  | { ok: true; byIri: Record<string, string> }
  | { ok: false; error: string };

async function fetchChunk(curieChunk: string[]): Promise<ChunkResult> {
  if (curieChunk.length === 0) return { ok: true, byIri: {} };
  const url = buildUrl(curieChunk);
  let json: GolrResponse;
  try {
    json = (await jsonpRequest(url)) as GolrResponse;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[labels] GOlr JSONP request failed for url:', url, err);
    return { ok: false, error: msg };
  }
  const out: Record<string, string> = {};
  const docs = json.response?.docs ?? [];
  for (const doc of docs) {
    const curie = doc.annotation_class;
    const label = doc.annotation_class_label;
    if (!curie || !label) continue;
    const iri = curieToIri(curie);
    if (!iri) continue;
    out[iri] = label;
  }
  return { ok: true, byIri: out };
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

async function runWithConcurrency<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function next(): Promise<void> {
    while (cursor < items.length) {
      const i = cursor;
      cursor += 1;
      results[i] = await worker(items[i]);
    }
  }
  const lanes = Array.from({ length: Math.min(concurrency, items.length) }, () => next());
  await Promise.all(lanes);
  return results;
}

export async function resolveLabels(iris: string[]): Promise<ResolveResult> {
  const curiesByIri = new Map<string, string>();
  for (const iri of iris) {
    const curie = iriToCurie(iri);
    if (!curie) continue;
    const prefix = curie.slice(0, curie.indexOf(':'));
    if (SKIP_CURIE_PREFIXES.has(prefix)) continue;
    curiesByIri.set(iri, curie);
  }
  const curies = Array.from(new Set(curiesByIri.values()));
  const chunks = chunk(curies, CHUNK_SIZE);
  const partials = await runWithConcurrency(
    chunks,
    (c) => fetchChunk(c),
    MAX_CONCURRENCY,
  );
  const merged: Record<string, string> = {};
  let failedChunks = 0;
  let lastError: string | undefined;
  for (const part of partials) {
    if (part.ok) {
      Object.assign(merged, part.byIri);
    } else {
      failedChunks += 1;
      lastError = part.error;
    }
  }
  return {
    byIri: merged,
    requestedCount: curiesByIri.size,
    resolvedCount: Object.keys(merged).length,
    failedChunks,
    totalChunks: chunks.length,
    lastError,
  };
}
