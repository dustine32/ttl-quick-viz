import { SegmentedControl, Slider } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setMinDegree,
  setStandaloneMode,
  type StandaloneMode,
} from '@/features/view-config/viewConfigSlice';
import {
  selectMinDegree,
  selectStandaloneMode,
} from '@/features/view-config/selectors';

export function FilterControls() {
  const dispatch = useAppDispatch();
  const standaloneMode = useAppSelector(selectStandaloneMode);
  const minDegree = useAppSelector(selectMinDegree);

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <span className="text-xs text-neutral-500">Standalone nodes</span>
        <SegmentedControl
          size="xs"
          value={standaloneMode}
          aria-label="Standalone nodes"
          data={[
            { value: 'hide', label: 'Connected' },
            { value: 'both', label: 'All' },
            { value: 'only', label: 'Orphans' },
          ]}
          onChange={(v) => dispatch(setStandaloneMode(v as StandaloneMode))}
        />
        <p className="text-xs text-neutral-400">
          Connected hides orphan nodes; All shows everything; Orphans replaces
          the canvas with a list of nodes that have no edges in the current
          view. Saved between sessions.
        </p>
      </div>
      <div className="flex flex-col gap-0.5">
        <div className="flex items-center justify-between text-xs text-neutral-500">
          <span>Min connections</span>
          <span className="tabular-nums">{minDegree === 0 ? 'All' : `≥ ${minDegree}`}</span>
        </div>
        <Slider
          size="xs"
          min={0}
          max={10}
          step={1}
          value={minDegree}
          onChange={(v) => dispatch(setMinDegree(v))}
          marks={[
            { value: 0 },
            { value: 1 },
            { value: 2 },
            { value: 3 },
            { value: 4 },
            { value: 5 },
            { value: 6 },
            { value: 7 },
            { value: 8 },
            { value: 9 },
            { value: 10 },
          ]}
        />
        <p className="text-xs text-neutral-400">
          Trims low-connectivity nodes after predicate and type filters.
        </p>
      </div>
    </div>
  );
}
