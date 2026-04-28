import { Button } from '@mantine/core';
import { useState } from 'react';
import {
  LuArrowLeft,
  LuArrowRight,
  LuInfo,
  LuShare2,
  LuTag,
} from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { DiffAttrsView, diffAttrs } from '@/features/diff';
import { useGetGraphQuery } from '@/features/graph';
import type { GraphEdge, GraphNode } from '@/features/graph';
import {
  AttrRow,
  extractTypesFromAttrs,
  InspectorHeader,
  KvRow,
  SectionHeader,
} from '@/features/inspector/InspectorUI';
import { MoreListModal } from '@/shared/components/MoreListModal';
import { requestReveal, selectEdge, selectNode } from '@/features/ui';
import { formatIri, selectLabelMode, useGraphDerivedData } from '@/features/view-config';

const VISIBLE_NEIGHBOR_LIMIT = 20;

type Neighbor = {
  edge: GraphEdge;
  direction: 'in' | 'out';
  neighborId: string;
};

export function NodeInspector({ nodeId }: { nodeId: string }) {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(selectedGraphId, { skip: !selectedGraphId });
  const compareGraph = useAppSelector((s) => s.diff.compareGraph);
  const diffMap = useAppSelector((s) => s.diff.diffMap);
  const [neighborsModalOpen, setNeighborsModalOpen] = useState(false);

  const labelMode = useAppSelector(selectLabelMode);
  const derived = useGraphDerivedData(data);
  const degree = derived.degree.get(nodeId) ?? 0;
  const node: GraphNode | undefined = data?.nodes.find((n) => n.id === nodeId);
  const diffStatus = diffMap?.nodes[nodeId];
  const previousNode: GraphNode | undefined = compareGraph?.nodes.find(
    (n) => n.id === nodeId,
  );

  const displayNode = node ?? previousNode;
  if (!displayNode) {
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
  const inDegree = neighbors.filter((n) => n.direction === 'in').length;
  const outDegree = neighbors.length - inDegree;
  const visibleNeighbors = neighbors.slice(0, VISIBLE_NEIGHBOR_LIMIT);
  const hasMoreNeighbors = neighbors.length > VISIBLE_NEIGHBOR_LIMIT;

  const attrEntries: [string, unknown][] = Object.entries(displayNode.attrs ?? {});
  const showDiff = diffStatus === 'changed' || diffStatus === 'added' || diffStatus === 'removed';
  const attrRows = showDiff ? diffAttrs(previousNode?.attrs, node?.attrs) : null;

  const formatted = formatIri(displayNode.id, labelMode, { label: displayNode.label });
  const showFullId = formatted !== displayNode.id;
  const types = extractTypesFromAttrs(displayNode.attrs);

  const selectEdgeAndReveal = (id: string) => {
    dispatch(selectEdge(id));
    dispatch(requestReveal());
  };
  const selectNeighborAndReveal = (id: string) => {
    dispatch(selectNode(id));
    dispatch(requestReveal());
  };

  return (
    <div className="flex flex-col gap-4">
      <InspectorHeader
        kind="node"
        diffStatus={diffStatus}
        primary={formatted}
        secondary={showFullId ? displayNode.id : undefined}
        types={types}
      />

      <div>
        <SectionHeader label="Properties" icon={<LuInfo size={11} />} />
        <div className="flex flex-col gap-0.5">
          <KvRow label="ID" value={displayNode.id} mono />
          {displayNode.label && displayNode.label !== displayNode.id && (
            <KvRow label="Label" value={displayNode.label} />
          )}
          <KvRow label="Degree">
            <div className="flex flex-nowrap items-center gap-2 text-[12px] tabular-nums">
              <span className="font-medium text-slate-900">{degree}</span>
              <span className="text-slate-400">·</span>
              <span className="flex items-center gap-1 text-blue-600">
                <LuArrowRight size={10} /> {outDegree} out
              </span>
              <span className="flex items-center gap-1 text-teal-600">
                <LuArrowLeft size={10} /> {inDegree} in
              </span>
            </div>
          </KvRow>
        </div>
      </div>

      {attrRows ? (
        <div>
          <SectionHeader
            label="Attributes (diff)"
            count={attrRows.length}
            icon={<LuTag size={11} />}
          />
          <DiffAttrsView rows={attrRows} />
        </div>
      ) : (
        attrEntries.length > 0 && (
          <div>
            <SectionHeader
              label="Attributes"
              count={attrEntries.length}
              icon={<LuTag size={11} />}
            />
            <div className="flex flex-col gap-1">
              {attrEntries.map(([k, v]) => (
                <AttrRow key={k} k={k} value={v} />
              ))}
            </div>
          </div>
        )
      )}

      <div>
        <SectionHeader
          label="Edges"
          count={neighbors.length}
          icon={<LuShare2 size={11} />}
        />
        {neighbors.length === 0 ? (
          <p className="px-1.5 text-xs text-slate-500">No connected edges.</p>
        ) : (
          <>
            <div className="flex flex-col gap-0.5">
              {visibleNeighbors.map(({ edge, direction, neighborId }) => (
                <NeighborRow
                  key={edge.id}
                  edge={edge}
                  direction={direction}
                  neighborId={neighborId}
                  onSelectEdge={() => selectEdgeAndReveal(edge.id)}
                  onSelectNeighbor={() => selectNeighborAndReveal(neighborId)}
                  labelMode={labelMode}
                />
              ))}
            </div>
            {hasMoreNeighbors && (
              <Button
                size="compact-xs"
                variant="subtle"
                color="gray"
                fullWidth
                onClick={() => setNeighborsModalOpen(true)}
                className="mt-1.5"
              >
                View all ({neighbors.length})
              </Button>
            )}
          </>
        )}
      </div>

      <MoreListModal
        opened={neighborsModalOpen}
        onClose={() => setNeighborsModalOpen(false)}
        title="Edges"
        total={neighbors.length}
        placeholder="Filter by predicate or neighbor…"
        renderItems={(query) => {
          const filtered = query
            ? neighbors.filter((n) => {
                const edgeLabel = (n.edge.label ?? n.edge.id).toLowerCase();
                return (
                  edgeLabel.includes(query) ||
                  n.neighborId.toLowerCase().includes(query)
                );
              })
            : neighbors;
          if (filtered.length === 0) {
            return <p className="px-1.5 text-xs text-slate-500">No matches.</p>;
          }
          return filtered.map(({ edge, direction, neighborId }) => (
            <NeighborRow
              key={edge.id}
              edge={edge}
              direction={direction}
              neighborId={neighborId}
              onSelectEdge={() => {
                selectEdgeAndReveal(edge.id);
                setNeighborsModalOpen(false);
              }}
              onSelectNeighbor={() => {
                selectNeighborAndReveal(neighborId);
                setNeighborsModalOpen(false);
              }}
              labelMode={labelMode}
            />
          ));
        }}
      />
    </div>
  );
}

type LabelMode = ReturnType<typeof selectLabelMode>;

function NeighborRow({
  edge,
  direction,
  neighborId,
  onSelectEdge,
  onSelectNeighbor,
  labelMode,
}: {
  edge: GraphEdge;
  direction: 'in' | 'out';
  neighborId: string;
  onSelectEdge: () => void;
  onSelectNeighbor: () => void;
  labelMode: LabelMode;
}) {
  const directionCls =
    direction === 'out'
      ? 'bg-blue-50 text-blue-600'
      : 'bg-teal-50 text-teal-600';
  return (
    <div className="group flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1.5 transition-colors hover:border-slate-200 hover:bg-slate-50">
      <span
        className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${directionCls}`}
        aria-label={direction === 'out' ? 'outgoing' : 'incoming'}
      >
        {direction === 'out' ? <LuArrowRight size={11} /> : <LuArrowLeft size={11} />}
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <button
          type="button"
          onClick={onSelectEdge}
          className="truncate text-left text-[12px] font-medium leading-tight text-slate-800 hover:text-blue-600"
        >
          {edge.label ? formatIri(edge.label, labelMode) : edge.id}
        </button>
        <button
          type="button"
          onClick={onSelectNeighbor}
          className="truncate text-left text-[10.5px] leading-snug text-slate-500 hover:text-blue-600"
        >
          {formatIri(neighborId, labelMode)}
        </button>
      </div>
    </div>
  );
}
