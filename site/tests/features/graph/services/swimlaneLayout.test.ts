import { describe, expect, it } from 'vitest';
import {
  computeSwimlaneLayout,
  GROUP_GAP_X,
  OTHER_LANE_KEY,
} from '@/features/graph/services/swimlaneLayout';
import type { Graph } from '@/features/graph/types';

function makeGraph(spec: Record<string, string[]>, edges: [string, string][] = []): Graph {
  const nodeIds = Object.values(spec).flat();
  return {
    nodes: nodeIds.map((id) => ({ id, label: id })),
    edges: edges.map(([s, t], i) => ({ id: `e${i}`, source: s, target: t })),
  };
}

const groupBy = (typeByNode: Map<string, string | null>) => (id: string) =>
  typeByNode.get(id) ?? null;

describe('computeSwimlaneLayout', () => {
  it('returns empty result for empty graph', () => {
    const r = computeSwimlaneLayout({ nodes: [], edges: [] }, { groupBy: () => null });
    expect(r.nodes).toEqual([]);
    expect(r.edges).toEqual([]);
    expect(r.groups).toEqual([]);
  });

  it('buckets nodes into top-level groups', () => {
    const types = new Map<string, string | null>([
      ['a1', 'A'],
      ['a2', 'A'],
      ['b1', 'B'],
    ]);
    const g = makeGraph({ all: ['a1', 'a2', 'b1'] });
    const r = computeSwimlaneLayout(g, { groupBy: groupBy(types) });
    const tops = r.groups.filter((g) => g.level === 0);
    expect(tops).toHaveLength(2);
    expect(tops.find((g) => g.key === 'A')!.count).toBe(2);
    expect(tops.find((g) => g.key === 'B')!.count).toBe(1);
  });

  it('places untyped nodes into the Other group', () => {
    const types = new Map<string, string | null>([
      ['a1', 'A'],
      ['x1', null],
    ]);
    const g = makeGraph({ all: ['a1', 'x1'] });
    const r = computeSwimlaneLayout(g, { groupBy: groupBy(types) });
    const other = r.groups.find((g) => g.key === OTHER_LANE_KEY);
    expect(other).toBeDefined();
    expect(other!.count).toBe(1);
    expect(other!.label).toBe('Other');
    expect(other!.isOther).toBe(true);
  });

  it('hideOther drops the Other group entirely', () => {
    const types = new Map<string, string | null>([
      ['a1', 'A'],
      ['x1', null],
    ]);
    const g = makeGraph({ all: ['a1', 'x1'] });
    const r = computeSwimlaneLayout(g, {
      groupBy: groupBy(types),
      hideOther: true,
    });
    expect(r.groups.find((g) => g.isOther)).toBeUndefined();
    expect(r.nodes.find((n) => n.id === 'x1')).toBeUndefined();
  });

  it('caps group count and merges overflow into Other', () => {
    const ids = Array.from({ length: 12 }, (_, i) => `n${i}`);
    const types = new Map<string, string | null>(ids.map((id, i) => [id, `T${i}`]));
    const g = makeGraph({ all: ids });
    const r = computeSwimlaneLayout(g, { groupBy: groupBy(types), maxLanes: 4 });
    const tops = r.groups.filter((g) => g.level === 0);
    expect(tops).toHaveLength(4);
    const other = tops.find((g) => g.isOther);
    expect(other).toBeDefined();
    expect(other!.count).toBe(9);
  });

  it('top groups are tiled horizontally with positive gap', () => {
    const types = new Map<string, string | null>([
      ['a1', 'A'],
      ['b1', 'B'],
    ]);
    const g = makeGraph({ all: ['a1', 'b1'] });
    const r = computeSwimlaneLayout(g, {
      groupBy: groupBy(types),
      targetRowWidth: 5000,
    });
    const tops = r.groups.filter((g) => g.level === 0);
    const [first, second] = tops;
    expect(first.x).toBe(0);
    expect(second.x).toBe(first.x + first.width + GROUP_GAP_X);
    expect(second.y).toBe(first.y);
  });

  it('all nodes of a group sit inside that group rectangle', () => {
    const types = new Map<string, string | null>([
      ['a1', 'A'],
      ['a2', 'A'],
      ['a3', 'A'],
    ]);
    const g = makeGraph({ all: ['a1', 'a2', 'a3'] }, [
      ['a1', 'a2'],
      ['a2', 'a3'],
    ]);
    const r = computeSwimlaneLayout(g, { groupBy: groupBy(types) });
    const top = r.groups.find((g) => g.level === 0)!;
    for (const n of r.nodes) {
      expect(n.position.x).toBeGreaterThanOrEqual(top.x);
      expect(n.position.x).toBeLessThanOrEqual(top.x + top.width);
      expect(n.position.y).toBeGreaterThanOrEqual(top.y);
      expect(n.position.y).toBeLessThanOrEqual(top.y + top.height);
    }
  });

  it('subGroupBy creates nested level-1 groups inside each top group', () => {
    const types = new Map<string, string | null>([
      ['a1', 'X'],
      ['a2', 'Y'],
      ['a3', 'X'],
    ]);
    const components = new Map<string, string | null>([
      ['a1', 'C'],
      ['a2', 'C'],
      ['a3', 'C'],
    ]);
    const g = makeGraph({ all: ['a1', 'a2', 'a3'] });
    const r = computeSwimlaneLayout(g, {
      groupBy: groupBy(components),
      subGroupBy: groupBy(types),
    });
    const tops = r.groups.filter((g) => g.level === 0);
    const subs = r.groups.filter((g) => g.level === 1);
    expect(tops).toHaveLength(1);
    expect(subs.length).toBeGreaterThanOrEqual(2);
    // Each sub-group sits inside its parent's rectangle.
    const top = tops[0];
    for (const s of subs) {
      expect(s.parentKey).toBe(top.key);
      expect(s.x).toBeGreaterThanOrEqual(top.x);
      expect(s.y).toBeGreaterThanOrEqual(top.y);
      expect(s.x + s.width).toBeLessThanOrEqual(top.x + top.width);
      expect(s.y + s.height).toBeLessThanOrEqual(top.y + top.height);
    }
  });

  it('drops edges whose endpoints are not present', () => {
    const types = new Map<string, string | null>([
      ['a1', 'A'],
      ['b1', 'B'],
    ]);
    const g = makeGraph({ all: ['a1', 'b1'] }, [
      ['a1', 'b1'],
      ['a1', 'missing'],
    ]);
    const r = computeSwimlaneLayout(g, { groupBy: groupBy(types) });
    expect(r.edges).toHaveLength(1);
    expect(r.edges[0].source).toBe('a1');
    expect(r.edges[0].target).toBe('b1');
  });
});
