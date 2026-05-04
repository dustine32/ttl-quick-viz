import { Select } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setLabelMode } from '@/features/view-config/viewConfigSlice';
import { selectLabelMode } from '@/features/view-config/selectors';
import type { LabelMode } from '@/features/view-config/viewConfigSlice';

const OPTIONS: { value: LabelMode; label: string }[] = [
  { value: 'label-id', label: 'Label (ID)' },
  { value: 'id-label', label: 'ID (Label)' },
  { value: 'label', label: 'Label only' },
  { value: 'prefixed', label: 'ID only' },
  { value: 'full', label: 'Full IRI' },
];

export function LabelModeToggle() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector(selectLabelMode);

  return (
    <Select
      size="xs"
      value={mode}
      allowDeselect={false}
      onChange={(value) => {
        if (value) dispatch(setLabelMode(value as LabelMode));
      }}
      data={OPTIONS}
    />
  );
}
