import { Group, Stack, UnstyledButton } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import type { GraphEdge } from '@/features/graph';
import { selectNode } from '@/features/ui';
import { formatIri, selectLabelMode } from '@/features/view-config';

export function EdgeInspector({ edgeId }: { edgeId: string }) {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(selectedGraphId, { skip: !selectedGraphId });

  const labelMode = useAppSelector(selectLabelMode);
  const edge: GraphEdge | undefined = data?.edges.find((e) => e.id === edgeId);

  if (!edge) {
    return (
      <p className="text-xs text-neutral-500">
        Edge not found in current graph.
      </p>
    );
  }

  const attrEntries: [string, unknown][] = Object.entries(edge.attrs ?? {});

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <div className="text-xs font-semibold uppercase text-neutral-500 tracking-[0.4px]">
          Edge
        </div>
        <div className="text-sm font-semibold break-all">
          {edge.label ? formatIri(edge.label, labelMode) : edge.id}
        </div>
      </Stack>

      <Row label="ID" value={edge.id} />

      <Row label="Source">
        <UnstyledButton onClick={() => dispatch(selectNode(edge.source))}>
          <span className="text-xs text-blue-600 break-all">
            {formatIri(edge.source, labelMode)}
          </span>
        </UnstyledButton>
      </Row>

      <Row label="Target">
        <UnstyledButton onClick={() => dispatch(selectNode(edge.target))}>
          <span className="text-xs text-blue-600 break-all">
            {formatIri(edge.target, labelMode)}
          </span>
        </UnstyledButton>
      </Row>

      {attrEntries.length > 0 && (
        <Stack gap={2}>
          <div className="text-xs font-semibold uppercase text-neutral-500 tracking-[0.4px]">
            Attributes
          </div>
          {attrEntries.map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </Stack>
      )}
    </Stack>
  );
}

function Row({
  label,
  value,
  children,
}: {
  label: string;
  value?: string;
  children?: React.ReactNode;
}) {
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <span className="text-xs text-neutral-500 min-w-16">{label}</span>
      <div className="flex-1 min-w-0">
        {children ?? (
          <span className="text-xs break-all">{value}</span>
        )}
      </div>
    </Group>
  );
}
