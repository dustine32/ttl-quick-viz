import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { Graph } from '@/features/graph/types';

// Mock elkjs with a deterministic layout.
vi.mock('elkjs/lib/elk.bundled.js', () => {
  class FakeELK {
    async layout(input: {
      children: Array<{ id: string; width: number; height: number }>;
      edges: Array<{ id: string; sources: string[]; targets: string[] }>;
    }) {
      return {
        ...input,
        children: input.children.map((c, i) => ({ ...c, x: i * 120, y: 0 })),
        edges: input.edges,
      };
    }
  }
  return { default: FakeELK };
});

// Import AFTER mock so the hook picks up the mocked module.
import { useElkLayout } from '@/features/graph/hooks/useElkLayout';

const graph: Graph = {
  nodes: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
    { id: 'c', label: 'C' },
  ],
  edges: [
    { id: 'ab', source: 'a', target: 'b' },
    { id: 'bc', source: 'b', target: 'c' },
  ],
};

describe('useElkLayout', () => {
  it('returns status "ready" and positioned nodes/edges for a valid graph', async () => {
    const { result } = renderHook(() => useElkLayout(graph));

    await waitFor(() => {
      expect(result.current.status).toBe('ready');
    });

    expect(result.current.nodes).toHaveLength(3);
    expect(result.current.edges).toHaveLength(2);

    const first = result.current.nodes[0];
    expect(first.id).toBe('a');
    expect(typeof first.position.x).toBe('number');
    expect(typeof first.position.y).toBe('number');

    const firstEdge = result.current.edges[0];
    expect(firstEdge.source).toBe('a');
    expect(firstEdge.target).toBe('b');
  });

  it('returns status "idle" with empty arrays when graph is undefined', () => {
    const { result } = renderHook(() => useElkLayout(undefined));
    expect(result.current.status).toBe('idle');
    expect(result.current.nodes).toEqual([]);
    expect(result.current.edges).toEqual([]);
  });
});
