/**
 * Best-effort `(triple) → line` mapping over a raw TTL document.
 *
 * GO-CAM TTL is conventionally written stanza-by-subject — a single subject
 * IRI followed by predicate/object pairs separated by `;` and grouped with
 * `,`. Matching on the IRI tail (the last `/`- or `#`-delimited segment)
 * survives both full-IRI and prefix-shortened forms (`obo:RO_0002411` and
 * `<http://purl.obolibrary.org/obo/RO_0002411>` both end in `RO_0002411`).
 *
 * This is intentionally not a Turtle parser — Phase 5 of the plan upgrades
 * to N3.js if line-precise mapping is required.
 */

export type EdgeLike = {
  source: string;
  target: string;
  label?: string | null;
};

export function tailOfIri(iri: string): string {
  if (!iri) return '';
  const slash = iri.lastIndexOf('/');
  const hash = iri.lastIndexOf('#');
  const cut = Math.max(slash, hash);
  return cut >= 0 ? iri.slice(cut + 1) : iri;
}

/**
 * Find the line index (0-based) most likely to be the source of `edge` in
 * the given TTL text. Returns `null` if no plausible match is found.
 *
 * Strategy:
 *   1. A line containing both the predicate tail and the target tail
 *      (matched on word-boundary, so `b` does not match `obolibrary`).
 *   2. Otherwise, the line where the source appears as the first token —
 *      i.e. its stanza header (`ex:a`, `<http://...>`, or `_:a`).
 *   3. Otherwise, give up.
 */
export function findEdgeLine(ttl: string, edge: EdgeLike): number | null {
  if (!ttl) return null;
  const lines = ttl.split(/\r?\n/);
  const sourceTail = tailOfIri(edge.source);
  const targetTail = tailOfIri(edge.target);
  const predTail = tailOfIri(edge.label ?? '');

  if (predTail && targetTail) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (containsToken(line, predTail) && containsToken(line, targetTail)) {
        return i;
      }
    }
  }

  if (sourceTail) {
    for (let i = 0; i < lines.length; i++) {
      const firstToken = lines[i].trimStart().split(/\s/)[0];
      if (!firstToken) continue;
      if (
        firstToken === sourceTail ||
        firstToken.endsWith(`:${sourceTail}`) ||
        firstToken === `<${edge.source}>`
      ) {
        return i;
      }
    }
  }

  return null;
}

/**
 * Substring match with a word-boundary guard. Avoids false positives like
 * `b` matching inside `obolibrary` while still working for prefixed names
 * (`ex:b`, where `b` is bounded by `:` and a space).
 */
function containsToken(line: string, tail: string): boolean {
  if (!tail) return false;
  if (tail.startsWith('_:')) {
    return line.includes(tail);
  }
  const escaped = tail.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`).test(line);
}

/**
 * Find the line that introduces `nodeId` as a subject. Falls back to the
 * first occurrence of the IRI tail anywhere in the file.
 *
 * In Turtle, a subject typically appears as the first whitespace-delimited
 * token on its line — either as a prefixed name (`ex:beta`), a bracketed
 * full IRI (`<http://...>`), or a blank node label (`_:b1234`). We check
 * for those forms first; if none matches, we accept any occurrence of the
 * tail.
 */
export function findNodeLine(ttl: string, nodeId: string): number | null {
  if (!ttl || !nodeId) return null;
  const lines = ttl.split(/\r?\n/);
  const tail = tailOfIri(nodeId);
  if (!tail) return null;

  for (let i = 0; i < lines.length; i++) {
    const firstToken = lines[i].trimStart().split(/\s/)[0];
    if (!firstToken) continue;
    if (
      firstToken === tail ||
      firstToken.endsWith(`:${tail}`) ||
      firstToken === `<${nodeId}>`
    ) {
      return i;
    }
  }

  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes(tail)) return i;
  }

  return null;
}
