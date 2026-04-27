import { Switch } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setSizeByDegree } from '@/features/view-config/viewConfigSlice';
import { selectSizeByDegree } from '@/features/view-config/selectors';

export function StylingControls() {
  const dispatch = useAppDispatch();
  const renderer = useAppSelector((s) => s.graph.renderer);
  const sizeByDegree = useAppSelector(selectSizeByDegree);

  return (
    <div className="flex flex-col gap-1">
      <Switch
        size="xs"
        label="Size nodes by degree"
        checked={sizeByDegree}
        onChange={(e) => dispatch(setSizeByDegree(e.currentTarget.checked))}
      />
      {renderer === 'xyflow' && sizeByDegree && (
        <p className="text-xs text-neutral-400">
          Degree sizing only applies in the Cytoscape and Force renderers.
        </p>
      )}
    </div>
  );
}
