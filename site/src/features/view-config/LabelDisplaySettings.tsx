import { Switch } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setLabelMode } from '@/features/view-config/viewConfigSlice';
import { selectLabelMode } from '@/features/view-config/selectors';
import {
  modeToToggles,
  togglesToMode,
} from '@/features/view-config/labelModeToggles';

// Three independent toggles for label display. Discoverable from the
// toolbar's settings popover and also embedded in the View panel.
export function LabelDisplaySettings() {
  const dispatch = useAppDispatch();
  const mode = useAppSelector(selectLabelMode);
  const t = modeToToggles(mode);

  const update = (next: typeof t) => dispatch(setLabelMode(togglesToMode(next)));

  return (
    <div className="flex flex-col gap-2.5">
      <Switch
        size="sm"
        label="Show labels"
        description="Render rdfs:label or resolved label when available"
        checked={t.showLabels}
        onChange={(e) => update({ ...t, showLabels: e.currentTarget.checked })}
      />
      <Switch
        size="sm"
        label="Show IDs"
        description="Render the term identifier alongside or instead of the label"
        checked={t.showIds}
        onChange={(e) => update({ ...t, showIds: e.currentTarget.checked })}
      />
      <Switch
        size="sm"
        label="Use full IRI"
        description="Render IDs as the full URL instead of CURIE shorthand"
        checked={t.useFullIri}
        disabled={!t.showIds}
        onChange={(e) => update({ ...t, useFullIri: e.currentTarget.checked })}
      />
    </div>
  );
}
