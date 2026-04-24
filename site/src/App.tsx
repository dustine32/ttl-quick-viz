import { SegmentedControl } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { GraphCanvas, setRenderer, type GraphRenderer } from '@/features/graph';
import { CytoscapeCanvas } from '@/features/graph-cytoscape';

export default function App() {
  const renderer = useAppSelector((s) => s.graph.renderer);
  const dispatch = useAppDispatch();

  return (
    <div className="flex h-dvh flex-col bg-neutral-50">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-2">
        <h1 className="text-sm font-medium text-neutral-700">TTL Quick Viz</h1>
        <SegmentedControl
          size="xs"
          value={renderer}
          onChange={(value) => dispatch(setRenderer(value as GraphRenderer))}
          data={[
            { label: 'React Flow', value: 'xyflow' },
            { label: 'Cytoscape', value: 'cytoscape' },
          ]}
        />
      </header>
      <main className="flex-1 min-h-0">
        {renderer === 'xyflow' ? <GraphCanvas /> : <CytoscapeCanvas />}
      </main>
    </div>
  );
}
