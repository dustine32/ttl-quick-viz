import type { LayoutOptions } from 'cytoscape';

export type CytoscapeLayout =
  | 'dagre'
  | 'breadthfirst'
  | 'cose'
  | 'concentric'
  | 'circle'
  | 'grid'
  | 'random';

export const CYTOSCAPE_LAYOUT_OPTIONS: { value: CytoscapeLayout; label: string }[] = [
  { value: 'dagre', label: 'Dagre (tree)' },
  { value: 'breadthfirst', label: 'Breadth-first' },
  { value: 'cose', label: 'Force (CoSE)' },
  { value: 'concentric', label: 'Concentric' },
  { value: 'circle', label: 'Circle' },
  { value: 'grid', label: 'Grid' },
  { value: 'random', label: 'Random' },
];

export function getCytoscapeLayout(algo: string): LayoutOptions {
  switch (algo) {
    case 'dagre':
      return {
        name: 'dagre',
        padding: 40,
        animate: false,
        rankDir: 'TB',
        ranker: 'network-simplex',
        nodeSep: 60,
        edgeSep: 20,
        rankSep: 120,
        spacingFactor: 1,
      } as unknown as LayoutOptions;
    case 'cose':
      return {
        name: 'cose',
        padding: 40,
        animate: false,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 120,
        edgeElasticity: () => 100,
        gravity: 0.25,
        numIter: 1500,
        componentSpacing: 120,
      };
    case 'concentric':
      return {
        name: 'concentric',
        padding: 40,
        animate: false,
        minNodeSpacing: 40,
        spacingFactor: 1.4,
      };
    case 'circle':
      return { name: 'circle', padding: 40, animate: false, spacingFactor: 1.4 };
    case 'grid':
      return { name: 'grid', padding: 40, animate: false, spacingFactor: 1.2 };
    case 'random':
      return { name: 'random', padding: 40, animate: false };
    case 'breadthfirst':
    default:
      return {
        name: 'breadthfirst',
        directed: true,
        padding: 40,
        spacingFactor: 1.5,
        animate: false,
      };
  }
}
