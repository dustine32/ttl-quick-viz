import { Tabs } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setRightPanelTab, type RightPanelTab } from '@/features/ui';
import { InspectorPanel } from '@/features/inspector';
import { ViewPanel } from '@/features/view-config';

export function RightPanel() {
  const dispatch = useAppDispatch();
  const tab = useAppSelector((s) => s.ui.rightPanelTab);

  return (
    <Tabs
      value={tab}
      onChange={(value) => value && dispatch(setRightPanelTab(value as RightPanelTab))}
      keepMounted={false}
      h="100%"
      styles={{ root: { display: 'flex', flexDirection: 'column' } }}
    >
      <Tabs.List grow>
        <Tabs.Tab value="properties">Properties</Tabs.Tab>
        <Tabs.Tab value="view">View</Tabs.Tab>
      </Tabs.List>

      <Tabs.Panel value="properties" p="sm" style={{ flex: 1, overflowY: 'auto' }}>
        <InspectorPanel />
      </Tabs.Panel>

      <Tabs.Panel value="view" p="sm" style={{ flex: 1, overflowY: 'auto' }}>
        <ViewPanel />
      </Tabs.Panel>
    </Tabs>
  );
}
