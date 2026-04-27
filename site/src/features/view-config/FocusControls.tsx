import { Button, Slider } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  clearFocus,
  setFocusDepth,
  setFocusNodeId,
} from '@/features/view-config/viewConfigSlice';
import {
  selectFocusDepth,
  selectFocusNodeId,
} from '@/features/view-config/selectors';
import { formatIri } from '@/features/view-config/prefixes';
import { selectLabelMode } from '@/features/view-config/selectors';
import { useGetGraphQuery } from '@/features/graph';

export function FocusControls() {
  const dispatch = useAppDispatch();
  const focusId = useAppSelector(selectFocusNodeId);
  const depth = useAppSelector(selectFocusDepth);
  const labelMode = useAppSelector(selectLabelMode);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(graphId, { skip: !graphId });

  const focusNode = focusId ? data?.nodes.find((n) => n.id === focusId) : undefined;
  const focusDisplay = focusNode
    ? formatIri(focusNode.id, labelMode, { label: focusNode.label })
    : null;

  return (
    <div className="flex flex-col gap-2">
      {focusId ? (
        <div className="flex flex-col gap-1">
          <div className="truncate text-xs text-neutral-600" title={focusId}>
            <span className="text-neutral-400">Focused: </span>
            <span className="font-medium">{focusDisplay ?? focusId}</span>
          </div>
          <div className="flex flex-nowrap items-center gap-1">
            <Button
              size="compact-xs"
              variant="default"
              disabled={!selectedNodeId || selectedNodeId === focusId}
              onClick={() => {
                if (selectedNodeId) dispatch(setFocusNodeId(selectedNodeId));
              }}
            >
              Refocus on selected
            </Button>
            <Button
              size="compact-xs"
              variant="default"
              onClick={() => dispatch(clearFocus())}
            >
              Clear
            </Button>
          </div>
        </div>
      ) : (
        <Button
          size="compact-xs"
          variant="default"
          disabled={!selectedNodeId}
          onClick={() => {
            if (selectedNodeId) dispatch(setFocusNodeId(selectedNodeId));
          }}
        >
          Focus on selected node
        </Button>
      )}

      <div className="flex flex-col gap-0.5">
        <div className="text-xs text-neutral-500">
          Depth <span className="tabular-nums">{depth}</span>
        </div>
        <Slider
          size="xs"
          min={0}
          max={6}
          step={1}
          value={depth}
          onChange={(v) => dispatch(setFocusDepth(v))}
          disabled={!focusId}
          marks={[
            { value: 0 },
            { value: 1 },
            { value: 2 },
            { value: 3 },
            { value: 4 },
            { value: 5 },
            { value: 6 },
          ]}
        />
      </div>
      <p className="text-xs text-neutral-400">
        Double-click a node on the canvas to reveal its neighbors.
      </p>
    </div>
  );
}
