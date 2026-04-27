import { buildTree } from '@/features/graph-tree/buildTree';
import type { Graph } from '@/features/graph';

const g = (nodes: string[], edges: [string, string, string?][]): Graph => ({
  nodes: nodes.map((id) => ({ id })),
  edges: edges.map(([source, target, label], i) => ({
    id: `e${i}`,
    source,
    target,
    label,
  })),
});

describe('buildTree', () => {
  it('returns empty result for an empty graph', () => {
    const out = buildTree({ nodes: [], edges: [] });
    expect(out.rootId).toBeNull();
    expect(out.tree.nodes).toHaveLength(0);
    expect(out.tree.edges).toHaveLength(0);
    expect(out.backEdges).toHaveLength(0);
    expect(out.orphans).toHaveLength(0);
    expect(out.hiddenChildCount.size).toBe(0);
  });

  it('builds a 3-node tree from a linear chain a -> b -> c', () => {
    const out = buildTree(g(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]));
    expect(out.rootId).toBe('a');
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(out.tree.edges.map((e) => e.id)).toEqual(['e0', 'e1']);
    expect(out.backEdges).toHaveLength(0);
    expect(out.orphans).toHaveLength(0);
  });

  it('breaks a simple cycle a -> b -> a and records 1 back-edge', () => {
    const out = buildTree(g(['a', 'b'], [['a', 'b'], ['b', 'a']]));
    expect(out.rootId).toBe('a');
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out.tree.edges.map((e) => e.id)).toEqual(['e0']);
    expect(out.backEdges.map((e) => e.id)).toEqual(['e1']);
  });

  it('breaks a longer cycle and keeps a sibling branch in the tree', () => {
    // a -> b -> c -> a, b -> d. No node has zero in-degree, so the
    // max-degree fallback picks 'b' (degree 3).
    const out = buildTree(
      g(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'a'], ['b', 'd']]),
    );
    expect(out.rootId).toBe('b');
    expect(out.tree.nodes.map((n) => n.id).sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(out.backEdges.map((e) => `${e.source}->${e.target}`)).toEqual(['a->b']);
  });

  it('lists unreachable nodes as orphans', () => {
    // a -> b is one component; c -> d is another. Root chosen from first.
    const out = buildTree(g(['a', 'b', 'c', 'd'], [['a', 'b'], ['c', 'd']]));
    expect(out.rootId).toBe('a');
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out.orphans.map((n) => n.id).sort()).toEqual(['c', 'd']);
  });

  it('honors an explicit rootId when present in the graph', () => {
    const out = buildTree(
      g(['a', 'b', 'c'], [['a', 'b'], ['a', 'c']]),
      { rootId: 'b' },
    );
    expect(out.rootId).toBe('b');
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['b']);
    expect(out.orphans.map((n) => n.id).sort()).toEqual(['a', 'c']);
  });

  it('falls back to highest-degree node when there are no sources (full cycle)', () => {
    // Triangle a -> b -> c -> a — every node has 1 in, 1 out. Degree-2 each.
    // Tie-break: lexicographic id wins.
    const out = buildTree(g(['a', 'b', 'c'], [['a', 'b'], ['b', 'c'], ['c', 'a']]));
    expect(out.rootId).toBe('a');
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['a', 'b', 'c']);
    expect(out.backEdges).toHaveLength(1);
  });

  it('walks reverse edges when direction is "in"', () => {
    // a -> b -> c, with direction 'in' the leaf becomes the root.
    const out = buildTree(
      g(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]),
      { direction: 'in' },
    );
    expect(out.rootId).toBe('c');
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['c', 'b', 'a']);
  });

  it('prunes children of a collapsed node and records hiddenChildCount', () => {
    // a -> b -> c -> d; collapse b. Tree: a, b. Hidden under b: c, d (2).
    const out = buildTree(
      g(['a', 'b', 'c', 'd'], [['a', 'b'], ['b', 'c'], ['c', 'd']]),
      { collapsedIds: new Set(['b']) },
    );
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out.tree.edges.map((e) => e.id)).toEqual(['e0']);
    expect(out.hiddenChildCount.get('b')).toBe(2);
  });

  it('does not record hiddenChildCount for a collapsed leaf (nothing under it)', () => {
    const out = buildTree(g(['a', 'b'], [['a', 'b']]), {
      collapsedIds: new Set(['b']),
    });
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['a', 'b']);
    expect(out.hiddenChildCount.has('b')).toBe(false);
  });

  it('still surfaces a collapsed root and hides its entire subtree', () => {
    const out = buildTree(g(['a', 'b', 'c'], [['a', 'b'], ['b', 'c']]), {
      collapsedIds: new Set(['a']),
    });
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['a']);
    expect(out.tree.edges).toHaveLength(0);
    expect(out.hiddenChildCount.get('a')).toBe(2);
  });

  it('orders children deterministically by (predicate, targetId)', () => {
    // a connects to b, c, d via predicates "z", "a", "a".
    // Sorted: ("a","c"), ("a","d"), ("z","b").
    const out = buildTree(
      g(
        ['a', 'b', 'c', 'd'],
        [
          ['a', 'b', 'z'],
          ['a', 'c', 'a'],
          ['a', 'd', 'a'],
        ],
      ),
    );
    expect(out.tree.nodes.map((n) => n.id)).toEqual(['a', 'c', 'd', 'b']);
  });
});
