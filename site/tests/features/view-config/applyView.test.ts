import { applyView } from '@/features/view-config/applyView';
import type { Graph } from '@/features/graph';

const graph: Graph = {
  nodes: [
    { id: 'a' },
    { id: 'b' },
    { id: 'c' },
    { id: 'd' },
    { id: 'orphan' },
  ],
  edges: [
    { id: 'e1', source: 'a', target: 'b', label: 'p' },
    { id: 'e2', source: 'a', target: 'c', label: 'p' },
    { id: 'e3', source: 'a', target: 'd', label: 'p' },
    { id: 'e4', source: 'b', target: 'c', label: 'q' },
  ],
};

const baseInput = {
  graph,
  hiddenPredicates: new Set<string>(),
  hiddenTypes: new Set<string>(),
  nodeTypes: new Map<string, string | null>(),
};

describe('applyView — new filters', () => {
  it('returns everything when no filters set', () => {
    const out = applyView(baseInput);
    expect(out.nodes).toHaveLength(5);
    expect(out.edges).toHaveLength(4);
  });

  it('standaloneMode=hide drops the orphan but keeps all connected nodes', () => {
    const out = applyView({ ...baseInput, standaloneMode: 'hide' });
    const ids = out.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'b', 'c', 'd']);
    expect(out.edges).toHaveLength(4);
  });

  it('standaloneMode=both is a no-op (canvas swap handles "only")', () => {
    const both = applyView({ ...baseInput, standaloneMode: 'both' });
    const only = applyView({ ...baseInput, standaloneMode: 'only' });
    expect(both.nodes.map((n) => n.id).sort()).toEqual(
      only.nodes.map((n) => n.id).sort(),
    );
    expect(both.edges).toHaveLength(only.edges.length);
  });

  it('minDegree=2 keeps a, b, c (each has ≥2 edges) and drops d (1 edge) and orphan', () => {
    const out = applyView({ ...baseInput, minDegree: 2 });
    const ids = out.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['a', 'b', 'c']);
    const edgeIds = out.edges.map((e) => e.id).sort();
    expect(edgeIds).toEqual(['e1', 'e2', 'e4']);
  });

  it('minDegree=3 keeps only a (3 edges) but a then has 0 edges, standaloneMode=hide clears it', () => {
    const out = applyView({
      ...baseInput,
      minDegree: 3,
      standaloneMode: 'hide',
    });
    expect(out.nodes).toHaveLength(0);
    expect(out.edges).toHaveLength(0);
  });

  it('minDegree composes with hidden predicates', () => {
    const out = applyView({
      ...baseInput,
      hiddenPredicates: new Set(['q']),
      minDegree: 2,
    });
    const ids = out.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['a']);
  });

  it('standaloneMode=hide after predicate hide cascades correctly', () => {
    const out = applyView({
      ...baseInput,
      hiddenPredicates: new Set(['p']),
      standaloneMode: 'hide',
    });
    const ids = out.nodes.map((n) => n.id).sort();
    expect(ids).toEqual(['b', 'c']);
    expect(out.edges).toHaveLength(1);
    expect(out.edges[0].id).toBe('e4');
  });

  it('focus runs after the new filters', () => {
    const out = applyView({
      ...baseInput,
      standaloneMode: 'hide',
      focusNodeId: 'a',
      focusDepth: 1,
    });
    const ids = out.nodes.map((n) => n.id).sort();
    expect(ids).toContain('a');
    expect(ids).not.toContain('orphan');
  });
});
