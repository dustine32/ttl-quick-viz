import { renderHook, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import type { Graph } from '@/features/graph/types';

vi.mock('elkjs/lib/elk.bundled.js', () => {
  class FailingELK {
    async layout() {
      throw new Error('layout failed');
    }
  }
  return { default: FailingELK };
});

import { useElkLayout } from '@/features/graph/useElkLayout';

const graph: Graph = {
  nodes: [
    { id: 'a', label: 'A' },
    { id: 'b', label: 'B' },
  ],
  edges: [{ id: 'ab', source: 'a', target: 'b' }],
};

describe('useElkLayout error path', () => {
  it('falls back to (0,0) positions and status "error" when Elk rejects', async () => {
    const { result } = renderHook(() => useElkLayout(graph));

    await waitFor(() => {
      expect(result.current.status).toBe('error');
    });

    expect(result.current.nodes).toHaveLength(2);
    for (const n of result.current.nodes) {
      expect(n.position).toEqual({ x: 0, y: 0 });
    }
    expect(result.current.edges).toHaveLength(1);
    expect(result.current.error).toBeInstanceOf(Error);
    expect(result.current.error?.message).toBe('layout failed');
  });
});
