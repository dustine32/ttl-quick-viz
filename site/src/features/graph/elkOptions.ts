export const NODE_HEIGHT = 48;
export const MIN_NODE_WIDTH = 140;
export const MAX_NODE_WIDTH = 320;
const CHAR_WIDTH = 7.2;
const NODE_HPAD = 32;

export function estimateNodeWidth(label: string): number {
  const raw = label.length * CHAR_WIDTH + NODE_HPAD;
  return Math.max(MIN_NODE_WIDTH, Math.min(MAX_NODE_WIDTH, Math.round(raw)));
}

export type XyflowLayout =
  | 'layered'
  | 'mrtree'
  | 'radial'
  | 'force'
  | 'stress'
  | 'rectpacking';

export const XYFLOW_LAYOUT_OPTIONS: { value: XyflowLayout; label: string }[] = [
  { value: 'layered', label: 'Layered' },
  { value: 'mrtree', label: 'Tree' },
  { value: 'radial', label: 'Radial' },
  { value: 'force', label: 'Force' },
  { value: 'stress', label: 'Stress' },
  { value: 'rectpacking', label: 'Packed' },
];

export function getElkOptions(algo: string): Record<string, string> {
  const base: Record<string, string> = {
    'elk.algorithm': algo,
    'elk.spacing.nodeNode': '80',
    'elk.separateConnectedComponents': 'true',
    'elk.spacing.componentComponent': '120',
    'elk.padding': '[top=40,left=40,bottom=40,right=40]',
  };
  if (algo === 'layered') {
    return {
      ...base,
      'elk.direction': 'DOWN',
      'elk.layered.spacing.nodeNodeBetweenLayers': '140',
      'elk.layered.spacing.edgeNodeBetweenLayers': '40',
      'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
      'elk.layered.crossingMinimization.semiInteractive': 'true',
    };
  }
  if (algo === 'mrtree') {
    return {
      ...base,
      'elk.direction': 'DOWN',
      'elk.spacing.nodeNode': '70',
      'elk.mrtree.searchOrder': 'DFS',
    };
  }
  if (algo === 'force') {
    return {
      ...base,
      'elk.spacing.nodeNode': '160',
      'elk.spacing.componentComponent': '180',
      'elk.force.iterations': '800',
      'elk.force.repulsivePower': '1',
      'elk.force.temperature': '0.1',
      'elk.force.model': 'FRUCHTERMAN_REINGOLD',
    };
  }
  if (algo === 'stress') {
    return {
      ...base,
      'elk.spacing.nodeNode': '140',
      'elk.spacing.componentComponent': '180',
      'elk.stress.desiredEdgeLength': '220',
      'elk.stress.iterationLimit': '1000',
      'elk.stress.epsilon': '0.0001',
    };
  }
  if (algo === 'radial') {
    return {
      ...base,
      'elk.spacing.nodeNode': '120',
      'elk.radial.compactor': 'RADIAL_COMPACTION',
      'elk.radial.optimizationCriteria': 'EDGE_LENGTH_BY_POSITION',
    };
  }
  if (algo === 'rectpacking') {
    return {
      ...base,
      'elk.spacing.nodeNode': '40',
      'elk.aspectRatio': '1.6',
      'elk.rectpacking.optimizationGoal': 'MAX_SCALE_DRIVEN',
      'elk.rectpacking.lastPlaceShift': 'true',
    };
  }
  return base;
}
