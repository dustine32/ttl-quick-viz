import { ActionIcon, SegmentedControl, Tooltip } from '@mantine/core';
import { LuX } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setRightPanelOpen,
  setRightPanelTab,
  type RightPanelTab,
} from '@/features/ui';
import { InspectorPanel } from '@/features/inspector';
import { ViewPanel } from '@/features/view-config';
import { PanelHeader } from '@/layout/PanelHeader';

export function RightPanel() {
  const dispatch = useAppDispatch();
  const tab = useAppSelector((s) => s.ui.rightPanelTab);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title={
          <SegmentedControl
            size="xs"
            value={tab}
            onChange={(v) => dispatch(setRightPanelTab(v as RightPanelTab))}
            data={[
              { label: 'Inspector', value: 'properties' },
              { label: 'View', value: 'view' },
            ]}
          />
        }
        actions={
          <Tooltip label="Close panel (Ctrl+Alt+B)" withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label="Close panel"
              onClick={() => dispatch(setRightPanelOpen(false))}
            >
              <LuX size={14} />
            </ActionIcon>
          </Tooltip>
        }
      />
      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'properties' ? <InspectorPanel /> : <ViewPanel />}
      </div>
    </div>
  );
}
