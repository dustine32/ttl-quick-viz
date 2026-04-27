import {
  ActionIcon,
  Badge,
  CopyButton,
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="text-xs font-semibold uppercase tracking-[0.4px] text-neutral-500">
          Node
        </div>
        <div className="break-all text-sm font-semibold">
          {formatIri(node.id, labelMode, { label: node.label })}
        </div>
      </div>

      <KeyValueRow label="ID" value={node.id} />
      {node.label && node.label !== node.id && (
        <KeyValueRow label="Label" value={node.label} />
      )}

      {attrEntries.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="text-xs font-semibold uppercase tracking-[0.4px] text-neutral-500">
            Attributes
          </div>
          {attrEntries.map(([k, v]) => (
            <KeyValueRow key={k} label={k} value={String(v)} />
          ))}
        </div>
      )}

      <KeyValueRow label="Degree" value={String(degree)} />

      <div className="flex flex-col gap-0.5">
        <div className="text-xs font-semibold uppercase tracking-[0.4px] text-neutral-500">
          Edges ({neighbors.length})
        </div>
        {neighbors.length === 0 ? (
          <p className="text-xs text-neutral-500">
            No connected edges.
          </p>
        ) : (
          <div className="flex max-h-[260px] flex-col gap-0.5 overflow-auto">
            {neighbors.map(({ edge, direction, neighborId }) => (
              <div key={edge.id} className="flex flex-nowrap items-start gap-1.5">
                <Badge size="xs" variant="light" color={direction === 'out' ? 'blue' : 'teal'}>
                  {direction === 'out' ? '→' : '←'}
                </Badge>
                <div className="flex min-w-0 flex-1 flex-col">
                  <UnstyledButton onClick={() => dispatch(selectEdge(edge.id))}>
                    <span className="block truncate text-xs text-blue-600">
                      {edge.label ? formatIri(edge.label, labelMode) : edge.id}
                    </span>
                  </UnstyledButton>
                  <UnstyledButton
                    onClick={() => {
                      dispatch(selectNode(neighborId));
                      dispatch(requestReveal());
                    }}
                  >
                    <span className="block truncate break-all text-xs">
                      {formatIri(neighborId, labelMode)}
                    </span>
                  </UnstyledButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function KeyValueRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-nowrap items-start gap-1.5">
      <span className="min-w-16 text-xs text-neutral-500">{label}</span>
      <span className="flex-1 break-all text-xs">{value}</span>
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
    </div>
  );
}
