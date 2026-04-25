import {
  ActionIcon,
  Badge,
  CopyButton,
  Group,
  ScrollArea,
  Stack,
  Tooltip,
  UnstyledButton,
} from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import type { GraphEdge, GraphNode } from '@/features/graph';
import { requestReveal, selectEdge, selectNode } from '@/features/ui';
import { formatIri, selectLabelMode, useGraphDerivedData } from '@/features/view-config';

type Neighbor = {
  edge: GraphEdge;
  direction: 'in' | 'out';
  neighborId: string;
};

export function NodeInspector({ nodeId }: { nodeId: string }) {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(selectedGraphId, { skip: !selectedGraphId });

  const labelMode = useAppSelector(selectLabelMode);
  const derived = useGraphDerivedData(data);
  const degree = derived.degree.get(nodeId) ?? 0;
  const node: GraphNode | undefined = data?.nodes.find((n) => n.id === nodeId);

  if (!node) {
    return (
      <p className="text-xs text-neutral-500">
        Node not found in current graph.
      </p>
    );
  }

  const neighbors: Neighbor[] = (data?.edges ?? [])
    .filter((e) => e.source === nodeId || e.target === nodeId)
    .map((e) => ({
      edge: e,
      direction: e.source === nodeId ? 'out' : 'in',
      neighborId: e.source === nodeId ? e.target : e.source,
    }));

  const attrEntries: [string, unknown][] = Object.entries(node.attrs ?? {});

  return (
    <Stack gap="sm">
      <Stack gap={2}>
        <div className="text-xs font-semibold uppercase text-neutral-500 tracking-[0.4px]">
          Node
        </div>
        <div className="text-sm font-semibold break-all">
          {formatIri(node.id, labelMode, { label: node.label })}
        </div>
      </Stack>

      <KeyValueRow label="ID" value={node.id} />
      {node.label && node.label !== node.id && (
        <KeyValueRow label="Label" value={node.label} />
      )}

      {attrEntries.length > 0 && (
        <Stack gap={2}>
          <div className="text-xs font-semibold uppercase text-neutral-500 tracking-[0.4px]">
            Attributes
          </div>
          {attrEntries.map(([k, v]) => (
            <KeyValueRow key={k} label={k} value={String(v)} />
          ))}
        </Stack>
      )}

      <KeyValueRow label="Degree" value={String(degree)} />

      <Stack gap={2}>
        <div className="text-xs font-semibold uppercase text-neutral-500 tracking-[0.4px]">
          Edges ({neighbors.length})
        </div>
        {neighbors.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No connected edges.
          </p>
        ) : (
          <ScrollArea.Autosize mah={260}>
            <Stack gap={2}>
              {neighbors.map(({ edge, direction, neighborId }) => (
                <Group key={edge.id} gap={6} wrap="nowrap" align="flex-start">
                  <Badge size="xs" variant="light" color={direction === 'out' ? 'blue' : 'teal'}>
                    {direction === 'out' ? '→' : '←'}
                  </Badge>
                  <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
                    <UnstyledButton onClick={() => dispatch(selectEdge(edge.id))}>
                      <span className="block text-xs text-blue-600 truncate">
                        {edge.label ? formatIri(edge.label, labelMode) : edge.id}
                      </span>
                    </UnstyledButton>
                    <UnstyledButton
                      onClick={() => {
                        dispatch(selectNode(neighborId));
                        dispatch(requestReveal());
                      }}
                    >
                      <span className="block text-xs truncate break-all">
                        {formatIri(neighborId, labelMode)}
                      </span>
                    </UnstyledButton>
                  </Stack>
                </Group>
              ))}
            </Stack>
          </ScrollArea.Autosize>
        )}
      </Stack>
    </Stack>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <Group gap={6} wrap="nowrap" align="flex-start">
      <span className="text-xs text-neutral-500 min-w-16">{label}</span>
      <span className="text-xs break-all flex-1">{value}</span>
      <CopyButton value={value}>
        {({ copied, copy }) => (
          <Tooltip label={copied ? 'Copied' : 'Copy'}>
            <ActionIcon size="xs" variant="subtle" color="gray" onClick={copy}>
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="9" y="9" width="12" height="12" rx="2" />
                <path d="M5 15V5a2 2 0 0 1 2-2h10" />
              </svg>
            </ActionIcon>
          </Tooltip>
        )}
      </CopyButton>
    </Group>
  );
}
