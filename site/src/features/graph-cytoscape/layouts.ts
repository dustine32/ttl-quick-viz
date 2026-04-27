import type { LayoutOptions } from 'cytoscape';

// Visual density: every layout's spacing knobs are tuned around this target.
// To make the whole picker tighter or looser, scale these together — don't
// nudge one layout in isolation (that's how this file ended up with no scale).
const PADDING = 75;
const EDGE_LEN = 175;       // ideal distance between connected nodes
const NODE_GAP = 95;        // min distance between unrelated nodes
const SPACING_FACTOR = 1.7; // multiplier for geometric layouts (circle/grid/etc.)

export type CytoscapeLayout =
  | 'fcose'
  | 'cose-bilkent'
  | 'cola'
  | 'euler'
  | 'cose'
  | 'spread'
  | 'dagre'
  | 'breadthfirst'
  | 'concentric'
  | 'circle'
  | 'grid'
  | 'random';

export const CYTOSCAPE_LAYOUT_OPTIONS: { value: CytoscapeLayout; label: string; group?: string }[] = [
  { value: 'fcose', label: 'fCoSE (fast, big graphs)', group: 'Force-directed' },
  { value: 'cose-bilkent', label: 'CoSE Bilkent (quality)', group: 'Force-directed' },
  { value: 'cola', label: 'Cola (constraints)', group: 'Force-directed' },
  { value: 'euler', label: 'Euler (fast)', group: 'Force-directed' },
  { value: 'cose', label: 'CoSE (built-in)', group: 'Force-directed' },
  { value: 'spread', label: 'Spread (dispersed)', group: 'Force-directed' },
  { value: 'dagre', label: 'Dagre (tree)', group: 'Hierarchical' },
  { value: 'breadthfirst', label: 'Breadth-first', group: 'Hierarchical' },
  { value: 'concentric', label: 'Concentric', group: 'Geometric' },
  { value: 'circle', label: 'Circle', group: 'Geometric' },
  { value: 'grid', label: 'Grid', group: 'Geometric' },
  { value: 'random', label: 'Random', group: 'Geometric' },
];

export function getCytoscapeLayout(algo: string): LayoutOptions {
  switch (algo) {
    case 'fcose':
      // Fast CoSE — best general-purpose for big graphs. quality:'proof' is
      // slowest/best; 'default' is the right speed/quality knee for our size.
      return {
        name: 'fcose',
        animate: false,
        padding: PADDING,
        quality: 'default',
        randomize: true,
        nodeSeparation: NODE_GAP,
        idealEdgeLength: EDGE_LEN,
        nodeRepulsion: 9000,
        gravity: 0.25,
        gravityRangeCompound: 1.5,
        numIter: 2500,
        tile: true,
        packComponents: true,
      } as unknown as LayoutOptions;
    case 'cose-bilkent':
      // Higher quality than the built-in `cose`, predecessor of fcose.
      // Slower on huge graphs but lays out nicely up to a few thousand nodes.
      return {
        name: 'cose-bilkent',
        animate: false,
        padding: PADDING,
        idealEdgeLength: EDGE_LEN,
        nodeRepulsion: 9500,
        edgeElasticity: 0.45,
        gravity: 0.25,
        gravityRangeCompound: 1.5,
        nestingFactor: 0.1,
        numIter: 3500,
        tile: true,
        randomize: true,
      } as unknown as LayoutOptions;
    case 'cola':
      // Cola.js — constraint-based force-directed; smooths long edges nicely.
      // `infinite:false` so it stops; `maxSimulationTime` caps the wall clock.
      return {
        name: 'cola',
        animate: false,
        padding: PADDING,
        randomize: true,
        edgeLength: EDGE_LEN,
        nodeSpacing: 26,
        avoidOverlap: true,
        infinite: false,
        maxSimulationTime: 4000,
        unconstrIter: 30,
        userConstIter: 0,
        allConstIter: 30,
      } as unknown as LayoutOptions;
    case 'euler':
      // Euler — fast spring-electric simulation. Tuned for spread + minimal
      // stuck-in-clump behavior on dense components.
      return {
        name: 'euler',
        animate: false,
        padding: PADDING,
        springLength: () => 200,
        springCoeff: () => 0.0008,
        mass: () => 4,
        gravity: -1.5,
        pull: 0.001,
        theta: 0.666,
        dragCoeff: 0.02,
        movementThreshold: 1,
        timeStep: 20,
        refresh: 50,
        maxIterations: 2000,
        maxSimulationTime: 6000,
        randomize: true,
      } as unknown as LayoutOptions;
    case 'spread':
      // Spread — disperses nodes by Voronoi after a CoSE prelayout. Use when
      // a force layout has clumped components and you want them evenly spaced.
      return {
        name: 'spread',
        animate: false,
        padding: PADDING,
        minDist: NODE_GAP,
        prelayout: { name: 'cose' },
        maxFruchtermanReingoldIterations: 1000,
        maxExpandIterations: 4,
        randomize: true,
      } as unknown as LayoutOptions;
    case 'dagre':
      return {
        name: 'dagre',
        padding: PADDING,
        animate: false,
        rankDir: 'TB',
        ranker: 'network-simplex',
        nodeSep: 110,
        edgeSep: 35,
        rankSep: 220,
        spacingFactor: 1.4,
      } as unknown as LayoutOptions;
    case 'cose':
      return {
        name: 'cose',
        padding: PADDING,
        animate: false,
        nodeRepulsion: () => 19000,
        idealEdgeLength: () => 200,
        edgeElasticity: () => 90,
        gravity: 0.2,
        numIter: 2000,
        componentSpacing: 220,
        nodeOverlap: 20,
      };
    case 'concentric':
      return {
        name: 'concentric',
        padding: PADDING,
        animate: false,
        minNodeSpacing: NODE_GAP,
        spacingFactor: SPACING_FACTOR,
      };
    case 'circle':
      return { name: 'circle', padding: PADDING, animate: false, spacingFactor: SPACING_FACTOR };
    case 'grid':
      return { name: 'grid', padding: PADDING, animate: false, spacingFactor: SPACING_FACTOR };
    case 'random':
      return { name: 'random', padding: PADDING, animate: false };
    case 'breadthfirst':
    default:
      return {
        name: 'breadthfirst',
        directed: true,
        padding: PADDING,
        spacingFactor: SPACING_FACTOR + 0.15,
        animate: false,
      };
  }
}
