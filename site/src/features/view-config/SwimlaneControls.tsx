import { NumberInput, SegmentedControl, Switch } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setSwimlaneGroupBy,
  setSwimlaneHideOther,
  setSwimlaneMaxLanes,
  setSwimlaneSubGroupBy,
  type SwimlaneGroupBy,
  type SwimlaneSubGroupBy,
} from '@/features/view-config/viewConfigSlice';
import {
  selectSwimlaneGroupBy,
  selectSwimlaneHideOther,
  selectSwimlaneMaxLanes,
  selectSwimlaneSubGroupBy,
} from '@/features/view-config/selectors';

export function SwimlaneControls() {
  const dispatch = useAppDispatch();
  const groupBy = useAppSelector(selectSwimlaneGroupBy);
  const subGroupBy = useAppSelector(selectSwimlaneSubGroupBy);
  const maxLanes = useAppSelector(selectSwimlaneMaxLanes);
  const hideOther = useAppSelector(selectSwimlaneHideOther);

  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-neutral-500">Group by</span>
        <SegmentedControl
          size="xs"
          fullWidth
          value={groupBy}
          onChange={(v) => dispatch(setSwimlaneGroupBy(v as SwimlaneGroupBy))}
          data={[
            { label: 'Subgraph', value: 'component' },
            { label: 'Type', value: 'type' },
          ]}
        />
      </div>

      <div className="flex flex-col gap-1">
        <span className="text-xs font-semibold text-neutral-500">Then by</span>
        <SegmentedControl
          size="xs"
          fullWidth
          value={subGroupBy}
          onChange={(v) => dispatch(setSwimlaneSubGroupBy(v as SwimlaneSubGroupBy))}
          data={[
            { label: 'None', value: 'none' },
            { label: 'Type', value: 'type' },
            { label: 'Subgraph', value: 'component' },
          ]}
        />
      </div>

      <NumberInput
        size="xs"
        label="Max groups"
        min={1}
        max={20}
        value={maxLanes}
        onChange={(v) => {
          if (typeof v === 'number') dispatch(setSwimlaneMaxLanes(v));
        }}
      />

      <Switch
        size="sm"
        label="Hide Other"
        checked={hideOther}
        onChange={(e) => dispatch(setSwimlaneHideOther(e.currentTarget.checked))}
      />
    </div>
  );
}
