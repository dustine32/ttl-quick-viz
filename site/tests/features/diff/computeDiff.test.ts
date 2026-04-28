import { describe, expect, it } from 'vitest';
import { computeDiff } from '@/features/diff/services/computeDiff';
import type { Graph } from '@/features/graph/types';

const g = (
  nodes: { id: string; label?: string; attrs?: Record<string, unknown> }[],
  edges: { id: string; source: string; target: string; label?: string; attrs?: Record<string, unknown> }[],
): Graph => ({ nodes, edges });

describe('computeDiff', () => {
  it('marks nodes added / removed / unchanged', () => {
    const current = g([{ id: 'a' }, { id: 'b' }, { id: 'c' }], []);
    const other = g([{ id: 'a' }, { id: 'b' }, { id: 'd' }], []);
    const result = computeDiff(current, other);
    expect(result.nodes.get('a')).toBe('unchanged');
    expect(result.nodes.get('b')).toBe('unchanged');
    expect(result.nodes.get('c')).toBe('added');
    expect(result.nodes.get('d')).toBe('removed');
  });

  it('marks nodes changed when attrs differ', () => {
    const current = g([{ id: 'a', attrs: { x: 1 } }], []);
    const other = g([{ id: 'a', attrs: { x: 2 } }], []);
    expect(computeDiff(current, other).nodes.get('a')).toBe('changed');
  });

  it('marks nodes unchanged when attrs key order differs but values match', () => {
    const current = g([{ id: 'a', attrs: { x: 1, y: 2 } }], []);
    const other = g([{ id: 'a', attrs: { y: 2, x: 1 } }], []);
    expect(computeDiff(current, other).nodes.get('a')).toBe('unchanged');
  });

  it('treats bnodes present on both sides as unchanged regardless of attrs', () => {
    const current = g([{ id: '_:b1', attrs: { foo: 'A' } }], []);
    const other = g([{ id: '_:b1', attrs: { foo: 'B' } }], []);
    expect(computeDiff(current, other).nodes.get('_:b1')).toBe('unchanged');
  });

  it('keys edges by (source, predicate, target) ignoring synthetic ids', () => {
    const current = g(
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'a|p|b|0', source: 'a', target: 'b', label: 'p' }],
    );
    const other = g(
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'a|p|b|99', source: 'a', target: 'b', label: 'p' }],
    );
    const result = computeDiff(current, other);
    expect(result.edges.get('a|p|b|0')).toBe('unchanged');
  });

  it('marks edges added when not in other', () => {
    const current = g(
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'a|p|b|0', source: 'a', target: 'b', label: 'p' }],
    );
    const other = g([{ id: 'a' }, { id: 'b' }], []);
    expect(computeDiff(current, other).edges.get('a|p|b|0')).toBe('added');
  });

  it('marks edges removed when only in other', () => {
    const current = g([{ id: 'a' }, { id: 'b' }], []);
    const other = g(
      [{ id: 'a' }, { id: 'b' }],
      [{ id: 'a|p|b|0', source: 'a', target: 'b', label: 'p' }],
    );
    expect(computeDiff(current, other).edges.get('a|p|b|0')).toBe('removed');
  });
});
