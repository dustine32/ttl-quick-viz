import { Select } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { XYFLOW_LAYOUT_OPTIONS } from '@/features/graph/elkOptions';
import { CYTOSCAPE_LAYOUT_OPTIONS } from '@/features/graph-cytoscape/layouts';
import { setLayoutAlgo } from '@/features/view-config/viewConfigSlice';
import {
  selectLayoutAlgoCytoscape,
  selectLayoutAlgoXyflow,
} from '@/features/view-config/selectors';

export function LayoutPicker() {
  const dispatch = useAppDispatch();
  const renderer = useAppSelector((s) => s.graph.renderer);
  const xyflowAlgo = useAppSelector(selectLayoutAlgoXyflow);
  const cytoscapeAlgo = useAppSelector(selectLayoutAlgoCytoscape);

  if (
    renderer === 'force' ||
    renderer === 'force3d' ||
    renderer === 'sigma' ||
    renderer === 'graphin'
  ) {
    return null;
  }

  const options = renderer === 'xyflow' ? XYFLOW_LAYOUT_OPTIONS : CYTOSCAPE_LAYOUT_OPTIONS;
  const value = renderer === 'xyflow' ? xyflowAlgo : cytoscapeAlgo;

  return (
    <Select
      size="xs"
      w={140}
      value={value}
      data={options.map((o) => ({ value: o.value, label: o.label }))}
      onChange={(v) => {
        if (!v) return;
        dispatch(setLayoutAlgo({ renderer, algo: v }));
      }}
      allowDeselect={false}
      aria-label="Layout algorithm"
    />
  );
}
