import { ActionIcon, CopyButton, Loader, Tooltip } from '@mantine/core';
import { Highlight, themes } from 'prism-react-renderer';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LuCheck, LuCopy, LuTarget, LuX } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  useGetGraphQuery,
  useGetGraphTtlQuery,
  type GraphEdge,
  type GraphNode,
} from '@/features/graph';
import {
  requestReveal,
  selectEdge,
  selectNode,
  setBottomPanelOpen,
} from '@/features/ui';
import {
  applyView,
  selectFocusDepth,
  selectFocusNodeId,
  selectHiddenPredicates,
  selectHiddenTypes,
  selectMinDegree,
  selectRevealedNodeIds,
  selectStandaloneMode,
  useGraphDerivedData,
} from '@/features/view-config';
import { findEdgeLine, findNodeLine, tailOfIri } from '@/features/ttl-source/findLine';
import { TtlDiffPane } from '@/features/ttl-source/TtlDiffPane';
import '@/features/ttl-source/registerTurtle';

type LineTarget =
  | { kind: 'edge'; edge: GraphEdge; visible: boolean }
  | { kind: 'node'; node: GraphNode; visible: boolean };

type BareLineTarget =
  | { kind: 'edge'; edge: GraphEdge }
  | { kind: 'node'; node: GraphNode };

// Skip the line→target index entirely on graphs this big — building and
// rendering thousands of clickable gutter rows is more cost than the
// feature is worth, and the syntax-highlighted pane is still useful.
const TARGETS_MAX_ELEMENTS = 8_000;

export function TtlPane() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const bottomPanelOpen = useAppSelector((s) => s.ui.bottomPanelOpen);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const compareSha = useAppSelector((s) => s.diff.compareSha);
  const diffActive = compareSha != null;

  const skip = !bottomPanelOpen || !selectedGraphId;
  const {
    data: ttl,
    isFetching,
    error,
  } = useGetGraphTtlQuery(selectedGraphId ?? '', { skip });
  const { data: graph } = useGetGraphQuery(selectedGraphId ?? '', { skip });

  // View-config inputs — same set the canvases use, so the TTL pane's idea
  // of "what's currently visible" matches what the user sees on the graph.
  const hiddenPredicates = useAppSelector(selectHiddenPredicates);
  const hiddenTypes = useAppSelector(selectHiddenTypes);
  const focusNodeId = useAppSelector(selectFocusNodeId);
  const focusDepth = useAppSelector(selectFocusDepth);
  const revealedNodeIds = useAppSelector(selectRevealedNodeIds);
  const standaloneMode = useAppSelector(selectStandaloneMode);
  const minDegree = useAppSelector(selectMinDegree);
  const derived = useGraphDerivedData(graph);

  const visibility = useMemo(() => {
    if (!graph) {
      return {
        nodes: new Set<string>(),
        edges: new Set<string>(),
      };
    }
    const filtered = applyView({
      graph,
      hiddenPredicates,
      hiddenTypes,
      nodeTypes: derived.nodeTypes,
      focusNodeId,
      focusDepth,
      revealedNodeIds,
      standaloneMode,
      minDegree,
    });
    return {
      nodes: new Set(filtered.nodes.map((n) => n.id)),
      edges: new Set(filtered.edges.map((e) => e.id)),
    };
  }, [
    graph,
    hiddenPredicates,
    hiddenTypes,
    derived.nodeTypes,
    focusNodeId,
    focusDepth,
    revealedNodeIds,
    standaloneMode,
    minDegree,
  ]);

  const lineCount = useMemo(
    () => (ttl ? ttl.split(/\r?\n/).length : 0),
    [ttl],
  );

  const highlightedLine = useMemo<number | null>(() => {
    if (!ttl) return null;
    if (selectedEdgeId && graph) {
      const edge = graph.edges.find((e) => e.id === selectedEdgeId);
      if (edge) return findEdgeLine(ttl, edge);
    }
    if (selectedNodeId) {
      return findNodeLine(ttl, selectedNodeId);
    }
    return null;
  }, [ttl, graph, selectedEdgeId, selectedNodeId]);

  // Expensive pass — runs only when the TTL or the graph changes (NOT on
  // filter changes). Builds an inverted index over the TTL once, then
  // does O(1) lookups per edge / node. Replaces the previous O(N×L)
  // approach that called findEdgeLine for every edge.
  const baseLineTargets = useMemo<Map<number, BareLineTarget[]>>(() => {
    const m = new Map<number, BareLineTarget[]>();
    if (!ttl || !graph) return m;
    if (graph.nodes.length + graph.edges.length > TARGETS_MAX_ELEMENTS) {
      return m; // graceful degradation on huge graphs
    }

    const lines = ttl.split(/\r?\n/);
    const tokenLines = new Map<string, number[]>();
    const firstTokenIdx = new Map<string, number>();
    const tokenRe = /_:[\w-]+|[A-Za-z_][\w-]*/g;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      let lastTok: string | null = null;
      for (const match of line.matchAll(tokenRe)) {
        const tok = match[0];
        if (tok === lastTok) continue;
        lastTok = tok;
        let arr = tokenLines.get(tok);
        if (!arr) {
          arr = [];
          tokenLines.set(tok, arr);
        }
        if (arr.length === 0 || arr[arr.length - 1] !== i) arr.push(i);
      }

      const trimmed = line.trimStart();
      if (trimmed.length === 0) continue;
      const wsIdx = trimmed.search(/\s/);
      const firstToken = wsIdx < 0 ? trimmed : trimmed.slice(0, wsIdx);
      let key: string | null = null;
      if (firstToken.startsWith('_:')) {
        key = firstToken;
      } else if (firstToken.startsWith('<') && firstToken.endsWith('>')) {
        const iri = firstToken.slice(1, -1);
        const slash = iri.lastIndexOf('/');
        const hash = iri.lastIndexOf('#');
        const cut = Math.max(slash, hash);
        key = cut >= 0 ? iri.slice(cut + 1) : iri;
      } else {
        const colon = firstToken.lastIndexOf(':');
        key = colon >= 0 ? firstToken.slice(colon + 1) : firstToken;
      }
      if (key && !firstTokenIdx.has(key)) firstTokenIdx.set(key, i);
    }

    const findEdgeFast = (edge: GraphEdge): number | null => {
      const sourceTail = tailOfIri(edge.source);
      const targetTail = tailOfIri(edge.target);
      const predTail = tailOfIri(edge.label ?? '');
      if (predTail && targetTail) {
        const a = tokenLines.get(predTail);
        const b = tokenLines.get(targetTail);
        if (a && b) {
          let i = 0;
          let j = 0;
          while (i < a.length && j < b.length) {
            if (a[i] === b[j]) return a[i];
            if (a[i] < b[j]) i++;
            else j++;
          }
        }
      }
      return sourceTail ? (firstTokenIdx.get(sourceTail) ?? null) : null;
    };

    const findNodeFast = (nodeId: string): number | null => {
      const tail = tailOfIri(nodeId);
      if (!tail) return null;
      const stanza = firstTokenIdx.get(tail);
      if (stanza !== undefined) return stanza;
      return tokenLines.get(tail)?.[0] ?? null;
    };

    const push = (idx: number, t: BareLineTarget) => {
      const arr = m.get(idx);
      if (arr) arr.push(t);
      else m.set(idx, [t]);
    };
    for (const edge of graph.edges) {
      const idx = findEdgeFast(edge);
      if (idx != null) push(idx, { kind: 'edge', edge });
    }
    for (const node of graph.nodes) {
      const idx = findNodeFast(node.id);
      if (idx != null) push(idx, { kind: 'node', node });
    }
    return m;
  }, [ttl, graph]);

  const lineTargets = useMemo<Map<number, LineTarget[]>>(() => {
    const m = new Map<number, LineTarget[]>();
    for (const [idx, bare] of baseLineTargets) {
      const annotated: LineTarget[] = bare.map((t) =>
        t.kind === 'edge'
          ? { kind: 'edge', edge: t.edge, visible: visibility.edges.has(t.edge.id) }
          : { kind: 'node', node: t.node, visible: visibility.nodes.has(t.node.id) },
      );
      annotated.sort((a, b) => {
        if (a.visible !== b.visible) return a.visible ? -1 : 1;
        return 0;
      });
      m.set(idx, annotated);
    }
    return m;
  }, [baseLineTargets, visibility]);

  const lineRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (highlightedLine == null) return;
    const el = lineRef.current;
    if (!el) return;
    el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [highlightedLine]);

  // Same flow as SearchBox.choose — proven to work end-to-end.
  const onTargetClick = useCallback(
    (target: LineTarget) => {
      if (target.kind === 'node') {
        dispatch(selectNode(target.node.id));
      } else {
        dispatch(selectEdge(target.edge.id));
      }
      dispatch(requestReveal());
    },
    [dispatch],
  );

  return (
    <div className="flex h-full flex-col bg-white text-gray-900">
      <div
        className="flex h-9 shrink-0 items-center justify-between gap-2 px-3"
        style={{
          background: 'var(--color-panel-elev)',
          borderBottom: '1px solid var(--color-border)',
        }}
      >
        <div className="flex flex-nowrap items-center gap-2">
          <span
            className="text-[12px] font-semibold tracking-tight"
            style={{ color: 'var(--color-text)' }}
          >
            {diffActive ? 'TTL Diff' : 'TTL Source'}
          </span>
          {selectedGraphId && (
            <span className="font-mono text-xs" style={{ color: 'var(--color-text-muted)' }}>
              {selectedGraphId}.ttl
              {diffActive && compareSha && (
                <span className="ml-1 text-amber-700">
                  vs <code>{compareSha.slice(0, 7)}</code>
                </span>
              )}
            </span>
          )}
          {isFetching && !diffActive && <Loader size={10} />}
          {!diffActive && highlightedLine != null && (
            <span className="text-xs tabular-nums" style={{ color: 'var(--color-text-dim)' }}>
              line {highlightedLine + 1} / {lineCount}
            </span>
          )}
        </div>
        <div className="flex flex-nowrap items-center gap-0.5">
          {ttl && !diffActive && (
            <CopyButton value={ttl}>
              {({ copied, copy }) => (
                <Tooltip label={copied ? 'Copied' : 'Copy TTL'} withArrow>
                  <ActionIcon size="sm" variant="subtle" color="gray" onClick={copy}>
                    {copied ? <LuCheck size={12} /> : <LuCopy size={12} />}
                  </ActionIcon>
                </Tooltip>
              )}
            </CopyButton>
          )}
          <Tooltip label="Hide TTL pane (Ctrl+J)" withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label="Close TTL pane"
              onClick={() => dispatch(setBottomPanelOpen(false))}
            >
              <LuX size={12} />
            </ActionIcon>
          </Tooltip>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {diffActive ? (
          <TtlDiffPane />
        ) : (
          <TtlBody
            selectedGraphId={selectedGraphId}
            isFetching={isFetching}
            error={error}
            ttl={ttl}
            highlightedLine={highlightedLine}
            lineRef={lineRef}
            lineTargets={lineTargets}
            onTargetClick={onTargetClick}
          />
        )}
      </div>
    </div>
  );
}

function TtlBody({
  selectedGraphId,
  isFetching,
  error,
  ttl,
  highlightedLine,
  lineRef,
  lineTargets,
  onTargetClick,
}: {
  selectedGraphId: string | null | undefined;
  isFetching: boolean;
  error: unknown;
  ttl: string | undefined;
  highlightedLine: number | null;
  lineRef: React.MutableRefObject<HTMLDivElement | null>;
  lineTargets: Map<number, LineTarget[]>;
  onTargetClick: (target: LineTarget) => void;
}) {
  if (!selectedGraphId) {
    return <Empty>Select a graph to view its TTL source.</Empty>;
  }
  if (isFetching && !ttl) {
    return <Empty>Loading TTL…</Empty>;
  }
  if (error) {
    return <Empty>{describeError(error, selectedGraphId)}</Empty>;
  }
  if (!ttl) {
    return <Empty>No TTL available.</Empty>;
  }
  return (
    <Highlight code={ttl} language="turtle" theme={themes.github}>
      {({ tokens, getTokenProps }) => (
        <pre className="m-0 whitespace-pre bg-transparent px-3 py-2 font-mono text-[11.5px] leading-[1.55]">
          {tokens.map((line, i) => {
            const isHighlight = i === highlightedLine;
            const targets = lineTargets.get(i);
            const target = targets?.[0];
            const extra = targets ? targets.length - 1 : 0;
            return (
              <div
                key={i}
                ref={isHighlight ? lineRef : undefined}
                data-testid={isHighlight ? 'ttl-highlighted-line' : undefined}
                className={`flex ${isHighlight ? 'bg-[rgba(22,119,255,0.18)]' : ''}`}
              >
                <span className="flex w-[26px] shrink-0 select-none items-center justify-center border-r border-[rgba(148,163,184,0.22)] bg-[rgba(15,23,42,0.035)]">
                  {target && (
                    <button
                      type="button"
                      title={
                        (target.visible
                          ? target.kind === 'edge'
                            ? 'Select edge in graph'
                            : 'Select node in graph'
                          : target.kind === 'edge'
                            ? 'Reveal edge (hidden by filter)'
                            : 'Reveal node (hidden by filter)') +
                        (extra > 0 ? ` (+${extra} more on this line)` : '')
                      }
                      aria-label={
                        target.visible ? 'Reveal in graph' : 'Reveal hidden element in graph'
                      }
                      onClick={() => onTargetClick(target)}
                      className={`flex h-4 w-4 cursor-pointer items-center justify-center rounded border-0 bg-transparent p-0 ${!target.visible
                          ? 'text-slate-400 opacity-50 hover:bg-slate-200/60'
                          : target.kind === 'edge'
                            ? 'text-violet-600 hover:bg-violet-100'
                            : 'text-sky-600 hover:bg-sky-100'
                        }`}
                    >
                      <LuTarget size={11} />
                    </button>
                  )}
                </span>
                <span className="min-w-[44px] select-none pr-3 text-right tabular-nums text-gray-400">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  {line.length === 0
                    ? ' '
                    : line.map((token, key) => (
                      <span key={key} {...getTokenProps({ token })} />
                    ))}
                </span>
              </div>
            );
          })}
        </pre>
      )}
    </Highlight>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full items-center justify-center text-xs text-neutral-500">
      {children}
    </div>
  );
}

function describeError(err: unknown, graphId: string): string {
  if (err && typeof err === 'object' && 'status' in err) {
    const status = (err as { status?: number | string }).status;
    if (status === 404) return `No TTL source on disk for ${graphId}.`;
    if (status === 503) return 'TTL source unavailable: INPUT_DIR is not configured on the api.';
  }
  return `Failed to load TTL for ${graphId}.`;
}
