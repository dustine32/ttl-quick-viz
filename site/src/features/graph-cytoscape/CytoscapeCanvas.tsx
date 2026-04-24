import { useEffect, useRef } from 'react';
import cytoscape from 'cytoscape';
import type { Core, ElementDefinition } from 'cytoscape';
import { useGetGraphQuery, useGetGraphsQuery } from '@/features/graph';

export function CytoscapeCanvas() {
  const { data: list, isLoading: listLoading } = useGetGraphsQuery();
  const firstId = list?.[0]?.id;
  const { data, isLoading, error } = useGetGraphQuery(firstId ?? '', {
    skip: !firstId,
  });
  const containerRef = useRef<HTMLDivElement | null>(null);
  const cyRef = useRef<Core | null>(null);

  useEffect(() => {
    if (!containerRef.current || !data) return;

    const elements: ElementDefinition[] = [
      ...data.nodes.map((n) => ({
        data: { id: n.id, label: n.label ?? n.id },
      })),
      ...data.edges.map((e) => ({
        data: {
          id: e.id,
          source: e.source,
          target: e.target,
          label: e.label ?? '',
        },
      })),
    ];

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': '#2563eb',
            label: 'data(label)',
            color: '#ffffff',
            'text-valign': 'center',
            'text-halign': 'center',
            'font-size': 10,
            'font-family': 'system-ui, sans-serif',
            width: 64,
            height: 64,
            'border-width': 2,
            'border-color': '#1e40af',
          },
        },
        {
          selector: 'edge',
          style: {
            width: 1.5,
            'line-color': '#9ca3af',
            'target-arrow-color': '#9ca3af',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            label: 'data(label)',
            'font-size': 8,
            'font-family': 'system-ui, sans-serif',
            'text-rotation': 'autorotate',
            'text-background-color': '#ffffff',
            'text-background-opacity': 0.9,
            'text-background-padding': 2,
            color: '#4b5563',
          },
        },
      ],
      layout: {
        name: 'breadthfirst',
        directed: true,
        padding: 24,
        spacingFactor: 1.1,
      },
      wheelSensitivity: 0.2,
    });

    cyRef.current = cy;

    return () => {
      cy.destroy();
      cyRef.current = null;
    };
  }, [data]);

  if (listLoading || isLoading) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        Loading…
      </div>
    );
  }

  if (list && list.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-neutral-500">
        No graphs available.
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center text-red-600">
        Failed to load graph.
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full bg-white" />;
}
