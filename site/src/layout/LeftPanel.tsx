import { ActionIcon, Tooltip } from '@mantine/core';
import { LuX } from 'react-icons/lu';
import { useAppDispatch } from '@/app/hooks';
import { setLeftPanelOpen } from '@/features/ui';
import { GraphList } from '@/features/graph';
import { PanelHeader } from '@/layout/PanelHeader';

export function LeftPanel() {
  const dispatch = useAppDispatch();
  return (
    <div className="flex h-full flex-col">
      <PanelHeader
        title="Graphs"
        actions={
          <Tooltip label="Close panel (Ctrl+B)" withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label="Close panel"
              onClick={() => dispatch(setLeftPanelOpen(false))}
            >
              <LuX size={14} />
            </ActionIcon>
          </Tooltip>
        }
      />
      <div className="flex-1 overflow-y-auto">
        <GraphList />
      </div>
    </div>
  );
}
