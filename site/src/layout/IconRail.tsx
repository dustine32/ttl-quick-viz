import { ActionIcon, Tooltip } from '@mantine/core';
import { useState } from 'react';
import {
  LuCircleHelp,
  LuCode,
  LuDatabase,
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
import { isWebviewMode } from '@/features/viewer';
import { ShortcutsModal } from '@/layout/ShortcutsModal';

type RailItem = {
  key: string;
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  active?: boolean;
};

export function IconRail() {
  const dispatch = useAppDispatch();
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
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

  // Two semantic groups: data toggles (Graphs) and panel toggles
  // (Inspector / View / TTL). A divider keeps them distinct in the rail.
  // The graph list is hidden in webview mode — only one file is open there.
  const dataGroup: RailItem[] = isWebviewMode()
    ? []
    : [
        {
          key: 'graphs',
          icon: <LuDatabase size={18} />,
          label: 'Graphs (Ctrl+B)',
          active: leftPanelOpen,
          onClick: () => dispatch(toggleLeftPanel()),
        },
      ];

  const panelGroup: RailItem[] = [
    {
      key: 'inspector',
      icon: <LuPanelRight size={18} />,
      label: 'Inspector (Ctrl+Alt+B)',
      active: rightPanelOpen && rightTab === 'properties',
      onClick: () => showRightTab('properties'),
    },
    {
      key: 'view',
      icon: <LuSettings2 size={18} />,
      label: 'View settings',
      active: rightPanelOpen && rightTab === 'view',
      onClick: () => showRightTab('view'),
    },
    {
      key: 'ttl',
      icon: <LuCode size={18} />,
      label: 'TTL source (Ctrl+J)',
      active: bottomPanelOpen,
      onClick: () => dispatch(toggleBottomPanel()),
    },
  ];

  return (
    <>
      <div
        className="flex h-full w-[48px] shrink-0 flex-col items-center border-r py-2"
        style={{ background: 'var(--color-rail-bg)', borderColor: 'var(--color-border)' }}
      >
        <div className="flex w-full flex-1 flex-col items-center gap-1">
          {dataGroup.map((item) => (
            <RailButton key={item.key} item={item} />
          ))}
          {dataGroup.length > 0 && (
            <div
              className="my-1.5 h-px w-6"
              style={{ background: 'var(--color-border)' }}
              aria-hidden
            />
          )}
          {panelGroup.map((item) => (
            <RailButton key={item.key} item={item} />
          ))}
        </div>

        <Tooltip label="Keyboard shortcuts" position="right" withArrow openDelay={300}>
          <ActionIcon
            size="lg"
            radius="md"
            variant="subtle"
            color="gray"
            aria-label="Keyboard shortcuts"
            onClick={() => setShortcutsOpen(true)}
            styles={{ root: { color: 'var(--color-text-muted)' } }}
          >
            <LuCircleHelp size={18} />
          </ActionIcon>
        </Tooltip>
      </div>

      <ShortcutsModal opened={shortcutsOpen} onClose={() => setShortcutsOpen(false)} />
    </>
  );
}

function RailButton({ item }: { item: RailItem }) {
  return (
    <Tooltip label={item.label} position="right" withArrow openDelay={300}>
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
  );
}
