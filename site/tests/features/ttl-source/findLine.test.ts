import { describe, expect, it } from 'vitest';
import {
  findEdgeLine,
  findNodeLine,
  tailOfIri,
} from '@/features/ttl-source/findLine';

describe('tailOfIri', () => {
  it('returns the segment after the last `/`', () => {
    expect(tailOfIri('http://example.com/foo/bar')).toBe('bar');
  });

  it('returns the segment after the last `#`', () => {
    expect(tailOfIri('http://example.com/foo#bar')).toBe('bar');
  });

  it('prefers the later of `/` and `#`', () => {
    expect(tailOfIri('http://example.com/foo#bar/baz')).toBe('baz');
  });

  it('returns the input when there is no separator', () => {
    expect(tailOfIri('local')).toBe('local');
  });

  it('returns "" for empty input', () => {
    expect(tailOfIri('')).toBe('');
  });

  it('passes through blank node ids untouched', () => {
    expect(tailOfIri('_:b1234')).toBe('_:b1234');
  });
});

describe('findEdgeLine — best-effort line search', () => {
  const TTL = `\
@prefix obo: <http://purl.obolibrary.org/obo/> .
@prefix ex: <http://example.com/> .

ex:a obo:RO_0002411 ex:b ;
     obo:RO_0002233 ex:c .

ex:b obo:RO_0002411 ex:d .
`;

  it('finds the line where predicate and target tails both appear', () => {
    const idx = findEdgeLine(TTL, {
      source: 'http://example.com/a',
      target: 'http://example.com/b',
      label: 'http://purl.obolibrary.org/obo/RO_0002411',
    });
    // line 4 (0-indexed) — `ex:a obo:RO_0002411 ex:b ;`
    expect(idx).toBe(3);
  });

  it('disambiguates between two edges with the same predicate', () => {
    const idx = findEdgeLine(TTL, {
      source: 'http://example.com/b',
      target: 'http://example.com/d',
      label: 'http://purl.obolibrary.org/obo/RO_0002411',
    });
    // last line — `ex:b obo:RO_0002411 ex:d .`
    expect(idx).toBe(6);
  });

  it('falls back to source-tail line when no predicate+target match exists', () => {
    const idx = findEdgeLine(TTL, {
      source: 'http://example.com/a',
      target: 'http://example.com/zzz-not-in-file',
      label: 'http://purl.obolibrary.org/obo/RO_0002411',
    });
    expect(idx).toBe(3); // first `a` line
  });

  it('returns null when nothing matches', () => {
    const idx = findEdgeLine(TTL, {
      source: 'http://example.com/zzz',
      target: 'http://example.com/zzz',
      label: 'http://example.com/zzz',
    });
    expect(idx).toBeNull();
  });

  it('handles edges with no predicate label', () => {
    const idx = findEdgeLine(TTL, {
      source: 'http://example.com/a',
      target: 'http://example.com/b',
      label: null,
    });
    // skips predicate-tail check; falls back to source tail.
    expect(idx).toBe(3);
  });

  it('returns null for empty ttl', () => {
    expect(
      findEdgeLine('', {
        source: 'http://example.com/a',
        target: 'http://example.com/b',
        label: 'p',
      }),
    ).toBeNull();
  });
});

describe('findNodeLine', () => {
  const TTL = `\
@prefix ex: <http://example.com/> .

ex:alpha
    ex:p1 ex:beta ;
    ex:p2 ex:gamma .

ex:beta ex:p3 ex:delta .
`;

  it('finds the stanza-leading line for a subject', () => {
    expect(findNodeLine(TTL, 'http://example.com/alpha')).toBe(2);
  });

  it('finds the stanza-leading line even when the subject is not the first line', () => {
    expect(findNodeLine(TTL, 'http://example.com/beta')).toBe(6);
  });

  it('falls back to first occurrence when the subject is never stanza-leading', () => {
    // delta only appears as an object
    expect(findNodeLine(TTL, 'http://example.com/delta')).toBe(6);
  });

  it('returns null when the node id is empty', () => {
    expect(findNodeLine(TTL, '')).toBeNull();
  });

  it('returns null when the ttl is empty', () => {
    expect(findNodeLine('', 'http://example.com/alpha')).toBeNull();
  });
});
