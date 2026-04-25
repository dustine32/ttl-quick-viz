import { Group } from '@mantine/core';
import { useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';

export function StatusBar() {
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(selectedGraphId, {
    skip: !selectedGraphId,
  });

  const nodeCount = data?.nodes.length ?? 0;
  const edgeCount = data?.edges.length ?? 0;

  return (
    <Group h="100%" px="sm" gap="md" justify="space-between" wrap="nowrap">
      <Group gap="md" wrap="nowrap">
        <span className="text-xs text-neutral-500">
          {selectedGraphId ? `Graph: ${selectedGraphId}` : 'No graph selected'}
        </span>
        <span className="text-xs text-neutral-500">
          {nodeCount} nodes · {edgeCount} edges
        </span>
      </Group>
    </Group>
  );
}
