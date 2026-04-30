export type GraphNode = {
  id: string;
  label?: string;
  attrs?: Record<string, unknown>;
};

export type GraphEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
  attrs?: Record<string, unknown>;
};

export type Graph = {
  nodes: GraphNode[];
  edges: GraphEdge[];
};
