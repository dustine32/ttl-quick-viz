import { SegmentedControl } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setLabelMode } from '@/features/view-config/viewConfigSlice';
import { selectLabelMode } from '@/features/view-config/selectors';
import type { LabelMode } from '@/features/view-config/viewConfigSlice';

export function LabelModeToggle() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector(selectLabelMode);

  return (
    <SegmentedControl
      size="xs"
      fullWidth
      value={mode}
      onChange={(value) => dispatch(setLabelMode(value as LabelMode))}
      data={[
        { label: 'Prefixed', value: 'prefixed' },
        { label: 'Label', value: 'label' },
        { label: 'Full', value: 'full' },
      ]}
    />
  );
}
