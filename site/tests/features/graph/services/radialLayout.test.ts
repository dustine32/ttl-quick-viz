import { describe, expect, it } from 'vitest';
import { computeRadialLayout } from '@/features/graph/services/radialLayout';
import type { Graph } from '@/features/graph/types';

function makeGraph(nodeIds: string[], edges: [string, string][]): Graph {
  return {
    nodes: nodeIds.map((id) => ({ id, label: id })),
    edges: edges.map(([s, t], i) => ({ id: `e${i}`, source: s, target: t })),
  };
}

describe('computeRadialLayout', () => {
  it('returns empty result for empty graph', () => {
    const r = computeRadialLayout({ nodes: [], edges: [] });
    expect(r.nodes).toEqual([]);
    expect(r.edges).toEqual([]);
  });

  it('places every node at a distinct position', () => {
    // A small graph with cycles + a chain — the kind of input ELK radial chokes on.
    const g = makeGraph(
      ['root', 'a', 'b', 'c', 'd', 'e'],
      [
        ['root', 'a'],
        ['root', 'b'],
        ['root', 'c'],
        ['a', 'd'],
        ['b', 'e'],
        ['d', 'e'], // cross-edge / cycle
      ],
    );
    const r = computeRadialLayout(g);
    expect(r.nodes).toHaveLength(6);

    const positions = r.nodes.map((n) => `${n.position.x.toFixed(2)},${n.position.y.toFixed(2)}`);
    const unique = new Set(positions);
    expect(unique.size).toBe(positions.length);
  });

  it('lays out children of root on a non-zero radius', () => {
    const g = makeGraph(
      ['r', 'a', 'b'],
      [
        ['r', 'a'],
        ['r', 'b'],
      ],
    );
    const r = computeRadialLayout(g, { ringSpacing: 200 });
    const root = r.nodes.find((n) => n.id === 'r')!;
    const a = r.nodes.find((n) => n.id === 'a')!;
    const b = r.nodes.find((n) => n.id === 'b')!;
    const dist = (p: { x: number; y: number }, q: { x: number; y: number }) =>
      Math.hypot(p.x - q.x, p.y - q.y);
    // Children sit on ring 1, so their distance from root must be roughly ringSpacing.
    expect(dist(root.position, a.position)).toBeGreaterThan(100);
    expect(dist(root.position, b.position)).toBeGreaterThan(100);
  });

  it('places disconnected components in disjoint regions', () => {
    const g = makeGraph(
      ['a1', 'a2', 'b1', 'b2'],
      [
        ['a1', 'a2'],
        ['b1', 'b2'],
      ],
    );
    const r = computeRadialLayout(g, { ringSpacing: 200 });
    const xs = r.nodes.map((n) => n.position.x);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    // Two components placed side-by-side — total width should be > one component.
    expect(maxX - minX).toBeGreaterThan(200);
  });

  it('does not blow up on a self-loop', () => {
    const g = makeGraph(['a', 'b'], [['a', 'a'], ['a', 'b']]);
    const r = computeRadialLayout(g);
    expect(r.nodes).toHaveLength(2);
    for (const n of r.nodes) {
      expect(Number.isFinite(n.position.x)).toBe(true);
      expect(Number.isFinite(n.position.y)).toBe(true);
    }
  });

  it('emits edges only for surviving endpoints', () => {
    const g = makeGraph(['a', 'b', 'c'], [['a', 'b'], ['a', 'c']]);
    const r = computeRadialLayout(g);
    expect(r.edges).toHaveLength(2);
  });
});
