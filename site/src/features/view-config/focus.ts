import type { Graph } from '@/features/graph';

export type FocusInput = {
  graph: Graph;
  focusNodeId: string;
  focusDepth: number;
  revealedNodeIds: Set<string>;
};

export function bfsFocus(input: FocusInput): Set<string> {
  const { graph, focusNodeId, focusDepth, revealedNodeIds } = input;

  const adj = new Map<string, Set<string>>();
  for (const n of graph.nodes) adj.set(n.id, new Set());
  for (const e of graph.edges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  const visible = new Set<string>();
  if (!adj.has(focusNodeId)) return visible;
  visible.add(focusNodeId);

  let frontier: string[] = [focusNodeId];
  for (let d = 0; d < focusDepth; d++) {
    const next: string[] = [];
    for (const id of frontier) {
      for (const nb of adj.get(id) ?? []) {
        if (!visible.has(nb)) {
          visible.add(nb);
          next.push(nb);
        }
      }
    }
    frontier = next;
    if (frontier.length === 0) break;
  }

  for (const rid of revealedNodeIds) {
    if (!adj.has(rid) || visible.has(rid)) continue;
    visible.add(rid);
    for (const nb of adj.get(rid) ?? []) visible.add(nb);
  }

  return visible;
}
