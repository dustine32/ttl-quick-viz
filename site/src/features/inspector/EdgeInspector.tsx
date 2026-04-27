import { UnstyledButton } from '@mantine/core';
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
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <div className="text-xs font-semibold uppercase tracking-[0.4px] text-neutral-500">
          Edge
        </div>
        <div className="break-all text-sm font-semibold">
          {edge.label ? formatIri(edge.label, labelMode) : edge.id}
        </div>
      </div>

      <Row label="ID" value={edge.id} />

      <Row label="Source">
        <UnstyledButton onClick={() => dispatch(selectNode(edge.source))}>
          <span className="break-all text-xs text-blue-600">
            {formatIri(edge.source, labelMode)}
          </span>
        </UnstyledButton>
      </Row>

      <Row label="Target">
        <UnstyledButton onClick={() => dispatch(selectNode(edge.target))}>
          <span className="break-all text-xs text-blue-600">
            {formatIri(edge.target, labelMode)}
          </span>
        </UnstyledButton>
      </Row>

      {attrEntries.length > 0 && (
        <div className="flex flex-col gap-0.5">
          <div className="text-xs font-semibold uppercase tracking-[0.4px] text-neutral-500">
            Attributes
          </div>
          {attrEntries.map(([k, v]) => (
            <Row key={k} label={k} value={String(v)} />
          ))}
        </div>
      )}
    </div>
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
    <div className="flex flex-nowrap items-start gap-1.5">
      <span className="min-w-16 text-xs text-neutral-500">{label}</span>
      <div className="min-w-0 flex-1">
        {children ?? (
          <span className="break-all text-xs">{value}</span>
        )}
      </div>
    </div>
  );
}
