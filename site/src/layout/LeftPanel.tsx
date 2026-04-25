import { Stack } from '@mantine/core';
import { GraphList } from '@/features/graph';

export function LeftPanel() {
  return (
    <Stack gap={0} h="100%">
      <div className="border-b border-neutral-200 px-3 py-2">
        <div className="text-xs font-semibold uppercase text-neutral-500 tracking-[0.4px]">
          Graphs
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        <GraphList />
      </div>
    </Stack>
  );
}
