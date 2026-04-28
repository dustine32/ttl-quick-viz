import { useHotkeys } from '@mantine/hooks';
import { notifications } from '@mantine/notifications';
import { useCallback } from 'react';
import { useAppDispatch } from '@/app/hooks';
import { openPicker } from '@/features/diff';
import { useConvertAllMutation } from '@/features/graph';
import {
  clearSelection,
  requestFitView,
  requestRelayout,
  togglePalette,
  toggleBottomPanel,
  toggleLeftPanel,
  toggleRightPanel,
} from '@/features/ui';

export function useAppHotkeys() {
  const dispatch = useAppDispatch();
  const [convertAll] = useConvertAllMutation();

  const rebuild = useCallback(async () => {
    try {
      const res = await convertAll().unwrap();
      notifications.show({
        color: res.errorCount === 0 ? 'teal' : 'red',
        title: res.errorCount === 0 ? 'Rebuild complete' : `Rebuild: ${res.errorCount} failed`,
        message:
          res.errorCount === 0
            ? `${res.okCount} converted, ${res.skippedCount} skipped`
            : res.results
                .filter((r) => !r.ok)
                .slice(0, 3)
                .map((r) => `${r.id}: ${r.error}`)
                .join('\n'),
        autoClose: res.errorCount === 0 ? 3000 : 6000,
      });
    } catch {
      notifications.show({
        color: 'red',
        title: 'Rebuild failed',
        message: 'Could not reach the conversion service',
        autoClose: 6000,
      });
    }
  }, [convertAll]);

  useHotkeys([
    ['mod+B', () => dispatch(toggleLeftPanel())],
    ['mod+alt+B', () => dispatch(toggleRightPanel())],
    ['mod+J', () => dispatch(toggleBottomPanel())],
    ['mod+K', () => dispatch(togglePalette())],
    ['mod+D', () => dispatch(openPicker())],
    ['F', () => dispatch(requestFitView())],
    ['R', () => dispatch(requestRelayout())],
    ['shift+R', rebuild],
    ['Escape', () => dispatch(clearSelection())],
  ]);
}
