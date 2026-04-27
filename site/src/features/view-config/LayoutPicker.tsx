import { Select } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { XYFLOW_LAYOUT_OPTIONS } from '@/features/graph/services/elkOptions';
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
    renderer === 'graphin' ||
    renderer === 'tree'
  ) {
    return null;
  }

  const options = renderer === 'xyflow' ? XYFLOW_LAYOUT_OPTIONS : CYTOSCAPE_LAYOUT_OPTIONS;
  const value = renderer === 'xyflow' ? xyflowAlgo : cytoscapeAlgo;

  // Group cytoscape options under section headings (Mantine renders them
  // styled in the dropdown). xyflow options are flat.
  const data = isGrouped(options)
    ? groupBySection(options)
    : options.map((o) => ({ value: o.value, label: o.label }));

  return (
    <Select
      size="xs"
      w={renderer === 'cytoscape' ? 200 : 140}
      value={value}
      data={data}
      onChange={(v) => {
        if (!v) return;
        dispatch(setLayoutAlgo({ renderer, algo: v }));
      }}
      allowDeselect={false}
      aria-label="Layout algorithm"
    />
  );
}

type LayoutOpt = { value: string; label: string; group?: string };

function isGrouped(options: readonly { value: string; label: string; group?: string }[]): boolean {
  return options.some((o) => o.group);
}

function groupBySection(options: readonly LayoutOpt[]) {
  const order: string[] = [];
  const buckets = new Map<string, { value: string; label: string }[]>();
  for (const o of options) {
    const key = o.group ?? 'Other';
    if (!buckets.has(key)) {
      buckets.set(key, []);
      order.push(key);
    }
    buckets.get(key)!.push({ value: o.value, label: o.label });
  }
  return order.map((group) => ({ group, items: buckets.get(group)! }));
}
