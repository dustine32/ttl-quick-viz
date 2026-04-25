import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';

let registered = false;

export function registerCytoscapeExtensions(): void {
  if (registered) return;
  registered = true;
  cytoscape.use(dagre);
}
