import type { Graph, GraphEdge, GraphNode } from '@/features/graph';

export type TreeDirection = 'out' | 'in';

export type BuildTreeOpts = {
  rootId?: string | null;
  collapsedIds?: Set<string>;
  direction?: TreeDirection;
};

export type BuildTreeResult = {
  tree: Graph;
  backEdges: GraphEdge[];
  orphans: GraphNode[];
  rootId: string | null;
  hiddenChildCount: Map<string, number>;
};

type AdjEntry = { childId: string; edge: GraphEdge };
type AdjacencyMap = Map<string, AdjEntry[]>;

function buildAdjacency(graph: Graph, direction: TreeDirection): AdjacencyMap {
  const adj: AdjacencyMap = new Map();
  for (const n of graph.nodes) adj.set(n.id, []);
  for (const e of graph.edges) {
    const parent = direction === 'out' ? e.source : e.target;
    const child = direction === 'out' ? e.target : e.source;
    adj.get(parent)?.push({ childId: child, edge: e });
  }
  for (const list of adj.values()) {
    list.sort((a, b) => {
      const la = a.edge.label ?? '';
      const lb = b.edge.label ?? '';
      if (la !== lb) return la.localeCompare(lb);
      return a.childId.localeCompare(b.childId);
    });
  }
  return adj;
}

function pickRoot(
  graph: Graph,
  adj: AdjacencyMap,
  rootId: string | null | undefined,
  direction: TreeDirection,
): string | null {
  if (graph.nodes.length === 0) return null;
  const ids = new Set(graph.nodes.map((n) => n.id));
  if (rootId && ids.has(rootId)) return rootId;

  const incoming = new Map<string, number>();
  for (const n of graph.nodes) incoming.set(n.id, 0);
  for (const e of graph.edges) {
    const inbound = direction === 'out' ? e.target : e.source;
    incoming.set(inbound, (incoming.get(inbound) ?? 0) + 1);
  }
  const sources: string[] = [];
  for (const [id, count] of incoming) {
    if (count === 0) sources.push(id);
  }
  if (sources.length > 0) {
    const withKids = sources.filter((id) => (adj.get(id) ?? []).length > 0);
    if (withKids.length > 0) return [...withKids].sort()[0];
    return [...sources].sort()[0];
  }

  const degree = new Map<string, number>();
  for (const n of graph.nodes) degree.set(n.id, 0);
  for (const e of graph.edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    if (e.target !== e.source) {
      degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
    }
  }
  let best: string | null = null;
  let bestDeg = -1;
  for (const [id, d] of degree) {
    if (d > bestDeg || (d === bestDeg && best !== null && id < best)) {
      bestDeg = d;
      best = id;
    }
  }
  return best;
}

type FullTree = {
  order: string[];
  treeEdges: GraphEdge[];
  childMap: Map<string, string[]>;
  backEdges: GraphEdge[];
};

function bfsFullTree(adj: AdjacencyMap, root: string): FullTree {
  const visited = new Set<string>([root]);
  const order: string[] = [root];
  const treeEdges: GraphEdge[] = [];
  const backEdges: GraphEdge[] = [];
  const childMap = new Map<string, string[]>();
  const queue: string[] = [root];

  while (queue.length > 0) {
    const parent = queue.shift() as string;
    const kids: string[] = [];
    for (const { childId, edge } of adj.get(parent) ?? []) {
      if (visited.has(childId)) {
        backEdges.push(edge);
        continue;
      }
      visited.add(childId);
      treeEdges.push(edge);
      kids.push(childId);
      order.push(childId);
      queue.push(childId);
    }
    if (kids.length > 0) childMap.set(parent, kids);
  }
  return { order, treeEdges, childMap, backEdges };
}

function countDescendants(childMap: Map<string, string[]>, root: string): number {
  let count = 0;
  const stack: string[] = [...(childMap.get(root) ?? [])];
  while (stack.length > 0) {
    const id = stack.pop() as string;
    count += 1;
    const kids = childMap.get(id);
    if (kids) stack.push(...kids);
  }
  return count;
}

export function buildTree(graph: Graph, opts: BuildTreeOpts = {}): BuildTreeResult {
  const direction = opts.direction ?? 'out';
  const collapsedIds = opts.collapsedIds ?? new Set<string>();
  const adj = buildAdjacency(graph, direction);
  const rootId = pickRoot(graph, adj, opts.rootId, direction);

  if (rootId === null) {
    return {
      tree: { nodes: [], edges: [] },
      backEdges: [],
      orphans: [...graph.nodes],
      rootId: null,
      hiddenChildCount: new Map(),
    };
  }

  const full = bfsFullTree(adj, rootId);
  const reachable = new Set(full.order);
  const orphans = graph.nodes.filter((n) => !reachable.has(n.id));

  const keptIds = new Set<string>([rootId]);
  const hiddenChildCount = new Map<string, number>();
  const stack: string[] = [rootId];
  while (stack.length > 0) {
    const parent = stack.pop() as string;
    if (collapsedIds.has(parent)) {
      const desc = countDescendants(full.childMap, parent);
      if (desc > 0) hiddenChildCount.set(parent, desc);
      continue;
    }
    for (const k of full.childMap.get(parent) ?? []) {
      keptIds.add(k);
      stack.push(k);
    }
  }

  const nodeById = new Map(graph.nodes.map((n) => [n.id, n]));
  const treeNodes: GraphNode[] = [];
  for (const id of full.order) {
    if (!keptIds.has(id)) continue;
    const n = nodeById.get(id);
    if (n) treeNodes.push(n);
  }
  const treeEdges = full.treeEdges.filter(
    (e) => keptIds.has(e.source) && keptIds.has(e.target),
  );

  return {
    tree: { nodes: treeNodes, edges: treeEdges },
    backEdges: full.backEdges,
    orphans,
    rootId,
    hiddenChildCount,
  };
}
