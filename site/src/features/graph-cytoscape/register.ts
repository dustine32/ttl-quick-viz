import cytoscape from 'cytoscape';
import dagre from 'cytoscape-dagre';
import fcose from 'cytoscape-fcose';
import cola from 'cytoscape-cola';
import euler from 'cytoscape-euler';
import spread from 'cytoscape-spread';
import coseBilkent from 'cytoscape-cose-bilkent';

let registered = false;

export function registerCytoscapeExtensions(): void {
  if (registered) return;
  registered = true;
  cytoscape.use(dagre);
  cytoscape.use(fcose);
  cytoscape.use(cola);
  cytoscape.use(euler);
  cytoscape.use(spread);
  cytoscape.use(coseBilkent);
}
