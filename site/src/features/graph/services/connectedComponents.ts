import type { Graph } from '@/features/graph/types';

export type ComponentInfo = {
  /** Stable key for the component (id of its representative node). */
  key: string;
  /** Node ids belonging to this component. */
  members: string[];
  /** A "best" node id chosen as the lane label (highest out-degree, then alphabetic). */
  representative: string;
};

/**
 * Union-find over the graph's edges (treated as undirected) — each weakly
 * connected component becomes one entry. Isolated nodes are their own
 * component.
 */
export function computeConnectedComponents(graph: Graph): {
  byNode: Map<string, string>;
  components: ComponentInfo[];
} {
  const parent = new Map<string, string>();
  const find = (x: string): string => {
    let cur = x;
    while (parent.get(cur) !== cur) {
      const p = parent.get(cur) ?? cur;
      parent.set(cur, parent.get(p) ?? p);
      cur = parent.get(cur) ?? cur;
    }
    return cur;
  };
  const union = (a: string, b: string) => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent.set(ra, rb);
  };

  for (const n of graph.nodes) parent.set(n.id, n.id);
  for (const e of graph.edges) {
    if (parent.has(e.source) && parent.has(e.target)) union(e.source, e.target);
  }

  // Bucket by root.
  const groups = new Map<string, string[]>();
  for (const n of graph.nodes) {
    const root = find(n.id);
    const list = groups.get(root);
    if (list) list.push(n.id);
    else groups.set(root, [n.id]);
  }

  // For lane labels, prefer the highest out-degree node (tie-break alphabetic).
  const outDeg = new Map<string, number>();
  for (const e of graph.edges) {
    outDeg.set(e.source, (outDeg.get(e.source) ?? 0) + 1);
  }

  const byNode = new Map<string, string>();
  const components: ComponentInfo[] = [];
  for (const [root, members] of groups) {
    let rep = members[0];
    let bestDeg = outDeg.get(rep) ?? 0;
    for (const id of members) {
      const d = outDeg.get(id) ?? 0;
      if (d > bestDeg || (d === bestDeg && id.localeCompare(rep) < 0)) {
        rep = id;
        bestDeg = d;
      }
    }
    components.push({ key: root, members, representative: rep });
    for (const id of members) byNode.set(id, root);
  }

  return { byNode, components };
}
