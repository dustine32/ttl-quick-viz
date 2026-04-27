import { ActionIcon, Tooltip } from '@mantine/core';
import {
  LuCircleHelp,
  LuCode,
  LuDatabase,
  LuInfo,
  LuPanelRight,
  LuSettings2,
} from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setRightPanelTab,
  toggleBottomPanel,
  toggleLeftPanel,
  toggleRightPanel,
  type RightPanelTab,
} from '@/features/ui';

type RailItem =
  | {
      kind: 'action';
      key: string;
      icon: React.ReactNode;
      label: string;
      onClick: () => void;
      active?: boolean;
    }
  | { kind: 'spacer' };

export function IconRail() {
  const dispatch = useAppDispatch();
  const leftPanelOpen = useAppSelector((s) => s.ui.leftPanelOpen);
  const rightPanelOpen = useAppSelector((s) => s.ui.rightPanelOpen);
  const rightTab = useAppSelector((s) => s.ui.rightPanelTab);
  const bottomPanelOpen = useAppSelector((s) => s.ui.bottomPanelOpen);

  const showRightTab = (tab: RightPanelTab) => {
    if (rightPanelOpen && rightTab === tab) {
      dispatch(toggleRightPanel());
      return;
    }
    dispatch(setRightPanelTab(tab));
    if (!rightPanelOpen) dispatch(toggleRightPanel());
  };

  const items: RailItem[] = [
    {
      kind: 'action',
      key: 'graphs',
      icon: <LuDatabase size={18} />,
      label: 'Graphs (Ctrl+B)',
      active: leftPanelOpen,
      onClick: () => dispatch(toggleLeftPanel()),
    },
    {
      kind: 'action',
      key: 'inspector',
      icon: <LuPanelRight size={18} />,
      label: 'Inspector',
      active: rightPanelOpen && rightTab === 'properties',
      onClick: () => showRightTab('properties'),
    },
    {
      kind: 'action',
      key: 'view',
      icon: <LuSettings2 size={18} />,
      label: 'View settings',
      active: rightPanelOpen && rightTab === 'view',
      onClick: () => showRightTab('view'),
    },
    {
      kind: 'action',
      key: 'ttl',
      icon: <LuCode size={18} />,
      label: 'TTL source (Ctrl+J)',
      active: bottomPanelOpen,
      onClick: () => dispatch(toggleBottomPanel()),
    },
    { kind: 'spacer' },
    {
      kind: 'action',
      key: 'help',
      icon: <LuCircleHelp size={18} />,
      label: 'Shortcuts',
      onClick: () => {
        /* placeholder */
      },
    },
    {
      kind: 'action',
      key: 'about',
      icon: <LuInfo size={18} />,
      label: 'About',
      onClick: () =>
        window.open('https://github.com/anthropics/claude-code', '_blank', 'noopener'),
    },
  ];

  return (
    <div
      className="flex h-full w-[48px] shrink-0 flex-col items-center border-r py-2"
      style={{ background: 'var(--color-rail-bg)', borderColor: 'var(--color-border)' }}
    >
      <div className="flex w-full flex-1 flex-col items-center gap-1">
        {items.map((item) =>
          item.kind === 'spacer' ? (
            <div key="spacer" className="flex-1" />
          ) : (
            <Tooltip key={item.key} label={item.label} position="right" withArrow openDelay={300}>
              <ActionIcon
                size="lg"
                radius="md"
                variant={item.active ? 'light' : 'subtle'}
                color={item.active ? 'sky' : 'gray'}
                aria-label={item.label}
                onClick={item.onClick}
                styles={{
                  root: {
                    color: item.active ? undefined : 'var(--color-text-muted)',
                  },
                }}
              >
                {item.icon}
              </ActionIcon>
            </Tooltip>
          ),
        )}
      </div>
    </div>
  );
}
