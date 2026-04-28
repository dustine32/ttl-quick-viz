import {
  LuArrowRight,
  LuArrowRightLeft,
  LuCircleDot,
  LuInfo,
  LuTag,
} from 'react-icons/lu';
import type { DiffStatus } from '@/features/diff';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { DiffAttrsView, diffAttrs } from '@/features/diff';
import { useGetGraphQuery } from '@/features/graph';
import type { GraphEdge } from '@/features/graph';
import {
  AttrRow,
  extractTypesFromAttrs,
  InspectorHeader,
  KvRow,
  SectionHeader,
} from '@/features/inspector/InspectorUI';
import { requestReveal, selectNode } from '@/features/ui';
import { formatIri, selectLabelMode } from '@/features/view-config';

export function EdgeInspector({ edgeId }: { edgeId: string }) {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data } = useGetGraphQuery(selectedGraphId, { skip: !selectedGraphId });
  const compareGraph = useAppSelector((s) => s.diff.compareGraph);
  const diffMap = useAppSelector((s) => s.diff.diffMap);

  const labelMode = useAppSelector(selectLabelMode);
  const edge: GraphEdge | undefined = data?.edges.find((e) => e.id === edgeId);

  // For "removed" edges, the id has the `__removed__|` prefix from useDiffOverlay.
  // Source it from compareGraph by stripping the prefix and looking up the original id.
  const removedOriginalId = edgeId.startsWith('__removed__|')
    ? edgeId.slice('__removed__|'.length)
    : null;
  const previousEdge: GraphEdge | undefined = compareGraph?.edges.find((e) =>
    removedOriginalId ? e.id === removedOriginalId : e.id === edgeId,
  );
  const displayEdge = edge ?? previousEdge;
  const diffStatus: DiffStatus | undefined =
    diffMap?.edges[edgeId] ?? (removedOriginalId ? 'removed' : undefined);

  if (!displayEdge) {
    return (
      <p className="text-xs text-neutral-500">
        Edge not found in current graph.
      </p>
    );
  }

  const attrEntries: [string, unknown][] = Object.entries(displayEdge.attrs ?? {});
  const showDiff =
    diffStatus === 'changed' ||
    diffStatus === 'added' ||
    diffStatus === 'removed' ||
    removedOriginalId != null;
  const attrRows = showDiff ? diffAttrs(previousEdge?.attrs, edge?.attrs) : null;

  const primaryLabel = displayEdge.label
    ? formatIri(displayEdge.label, labelMode)
    : displayEdge.id;

  const types = extractTypesFromAttrs(displayEdge.attrs);

  return (
    <div className="flex flex-col gap-4">
      <InspectorHeader
        kind="edge"
        diffStatus={diffStatus}
        primary={primaryLabel}
        secondary={displayEdge.label ? displayEdge.label : undefined}
        types={types}
      />

      <div>
        <SectionHeader label="Endpoints" icon={<LuArrowRightLeft size={11} />} />
        <div className="flex flex-col gap-0.5">
          <EndpointRow
            label="Source"
            iri={displayEdge.source}
            labelMode={labelMode}
            onClick={() => {
              dispatch(selectNode(displayEdge.source));
              dispatch(requestReveal());
            }}
          />
          <div
            className="ml-[26px] flex items-center gap-1 py-0.5 text-[10px] text-slate-400"
            aria-hidden
          >
            <LuArrowRight size={10} />
            <span>{primaryLabel}</span>
          </div>
          <EndpointRow
            label="Target"
            iri={displayEdge.target}
            labelMode={labelMode}
            onClick={() => {
              dispatch(selectNode(displayEdge.target));
              dispatch(requestReveal());
            }}
          />
        </div>
      </div>

      <div>
        <SectionHeader label="Properties" icon={<LuInfo size={11} />} />
        <div className="flex flex-col gap-0.5">
          <KvRow label="ID" value={displayEdge.id} mono />
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
    </div>
  );
}

type LabelMode = ReturnType<typeof selectLabelMode>;

function EndpointRow({
  label,
  iri,
  labelMode,
  onClick,
}: {
  label: string;
  iri: string;
  labelMode: LabelMode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex w-full items-start gap-2 rounded-md border border-transparent px-1.5 py-1.5 text-left transition-colors hover:border-sky-200 hover:bg-sky-50"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-50 text-sky-600 group-hover:bg-sky-100">
        <LuCircleDot size={11} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="text-[10px] font-medium uppercase tracking-[0.3px] text-slate-500">
          {label}
        </span>
        <span className="truncate text-[12px] leading-tight text-slate-800 group-hover:text-blue-600">
          {formatIri(iri, labelMode)}
        </span>
      </div>
    </button>
  );
}
