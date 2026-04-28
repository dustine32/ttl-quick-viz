import { Loader } from '@mantine/core';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { LuTarget } from 'react-icons/lu';
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  useGetGraphQuery,
  useGetGraphTtlAtQuery,
  useGetGraphTtlQuery,
  type GraphEdge,
  type GraphNode,
} from '@/features/graph';
import { requestReveal, selectEdge, selectNode } from '@/features/ui';
import { findEdgeLine, findNodeLine, tailOfIri } from '@/features/ttl-source/findLine';

type LineTarget =
  | { kind: 'edge'; edge: GraphEdge }
  | { kind: 'node'; node: GraphNode };

// Same threshold the non-diff TtlPane uses — beyond this, building the
// inverted line→targets index is more cost than the per-line button is
// worth. Click-from-graph-to-TTL still works because the data-rline
// attributes are stamped unconditionally below.
const TARGETS_MAX_ELEMENTS = 8_000;

/**
 * Inverted index: line index → graph nodes/edges that originated on that
 * line. Mirrors the logic in `TtlPane`'s `baseLineTargets` useMemo. Pure;
 * runs only when ttl or graph changes.
 */
function buildLineTargetsIndex(
  ttl: string,
  graph: { nodes: GraphNode[]; edges: GraphEdge[] },
): Map<number, LineTarget[]> {
  const m = new Map<number, LineTarget[]>();
  if (graph.nodes.length + graph.edges.length > TARGETS_MAX_ELEMENTS) return m;

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

  const push = (idx: number, t: LineTarget) => {
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
}

/**
 * Side-by-side TTL diff. Replaces `TtlBody` inside `TtlPane` when the user
 * has an active comparison from `state.diff`. Lines do NOT wrap — long
 * IRIs extend horizontally and the parent div provides a horizontal
 * scrollbar that scrolls both columns together (they share the underlying
 * table). Vertical scroll is synchronized by the library.
 *
 * Selecting a node/edge in the graph scrolls the matching line on the
 * *current* (right) side into view. The library doesn't expose a
 * scroll-to-line API, but `renderGutter` lets us inject a per-row span
 * with a stable `data-rline` attribute that we querySelector for.
 *
 * The same custom gutter also hosts the per-line target button (purple
 * for edges, sky for nodes) — clicking it selects the corresponding
 * graph element and dispatches `requestReveal`, mirroring the non-diff
 * `TtlPane` UX.
 */
export function TtlDiffPane() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const compareSha = useAppSelector((s) => s.diff.compareSha);
  const compareGraph = useAppSelector((s) => s.diff.compareGraph);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);

  const skip = !selectedGraphId || !compareSha;

  const { data: currentTtl, isFetching: currentLoading } = useGetGraphTtlQuery(
    selectedGraphId ?? '',
    { skip },
  );
  const { data: historicalTtl, isFetching: historicalLoading, error: historicalError } =
    useGetGraphTtlAtQuery(
      { id: selectedGraphId ?? '', sha: compareSha ?? '' },
      { skip },
    );
  const { data: graph } = useGetGraphQuery(selectedGraphId ?? '', { skip });

  const containerRef = useRef<HTMLDivElement | null>(null);

  const rightLineTargets = useMemo<Map<number, LineTarget[]>>(() => {
    if (!currentTtl || !graph) return new Map();
    return buildLineTargetsIndex(currentTtl, graph);
  }, [currentTtl, graph]);

  // Mirror for the historical side so removed nodes / removed edges have a
  // clickable LuTarget too, and so click-from-graph-to-line falls back to
  // the left side when the element doesn't exist on the right.
  const leftLineTargets = useMemo<Map<number, LineTarget[]>>(() => {
    if (!historicalTtl || !compareGraph) return new Map();
    return buildLineTargetsIndex(historicalTtl, compareGraph);
  }, [historicalTtl, compareGraph]);

  // Right side (current TTL) line — works for unchanged / added / changed.
  const rightHighlightLine = useMemo<number | null>(() => {
    if (!currentTtl) return null;
    if (selectedEdgeId && graph) {
      const edge = graph.edges.find((e) => e.id === selectedEdgeId);
      if (edge) return findEdgeLine(currentTtl, edge);
    }
    if (selectedNodeId) {
      return findNodeLine(currentTtl, selectedNodeId);
    }
    return null;
  }, [currentTtl, graph, selectedEdgeId, selectedNodeId]);

  // Left side (historical TTL) — fallback for *removed* nodes/edges, which
  // don't exist on the right at all. Without this, clicking a removed
  // element didn't scroll anywhere.
  const leftHighlightLine = useMemo<number | null>(() => {
    if (!historicalTtl) return null;
    if (selectedEdgeId && compareGraph) {
      const edge = compareGraph.edges.find((e) => e.id === selectedEdgeId);
      if (edge) return findEdgeLine(historicalTtl, edge);
    }
    if (selectedNodeId) {
      return findNodeLine(historicalTtl, selectedNodeId);
    }
    return null;
  }, [historicalTtl, compareGraph, selectedEdgeId, selectedNodeId]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;
    // Prefer the right side (the user's "current" frame of reference). If
    // the selection only exists on the historical side (a removed
    // node/edge), fall back to the left side. Either way, both columns
    // scroll together since they share the underlying table rows.
    if (rightHighlightLine != null) {
      const cell = root.querySelector(`[data-rline="${rightHighlightLine + 1}"]`);
      if (cell) {
        cell.scrollIntoView({ block: 'center', behavior: 'smooth' });
        return;
      }
    }
    if (leftHighlightLine != null) {
      const cell = root.querySelector(`[data-lline="${leftHighlightLine + 1}"]`);
      if (cell) {
        cell.scrollIntoView({ block: 'center', behavior: 'smooth' });
      }
    }
  }, [rightHighlightLine, leftHighlightLine, currentTtl, historicalTtl]);

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

  const renderGutter = useCallback(
    ({ lineNumber, prefix }: { lineNumber?: number; prefix?: string }) => {
      // The library inserts the return of `renderGutter` directly inside
      // the `<tr>` as a sibling of its other `<td>`s — so we MUST return a
      // `<td>`. Returning a `<span>` is invalid HTML and the browser
      // either drops it or reparents it, breaking `querySelector` lookups.
      if (!lineNumber || (prefix !== 'L' && prefix !== 'R')) {
        return <td style={{ width: 22 }} />;
      }
      const isRight = prefix === 'R';
      const targets = (isRight ? rightLineTargets : leftLineTargets).get(
        lineNumber - 1,
      );
      const target = targets?.[0];
      const extra = targets ? targets.length - 1 : 0;
      const dataAttr = isRight
        ? { 'data-rline': lineNumber }
        : { 'data-lline': lineNumber };
      return (
        <td
          {...dataAttr}
          style={{
            width: 22,
            textAlign: 'center',
            verticalAlign: 'middle',
            padding: 0,
          }}
        >
          {target && (
            <button
              type="button"
              title={
                (target.kind === 'edge'
                  ? 'Select edge in graph'
                  : 'Select node in graph') +
                (extra > 0 ? ` (+${extra} more on this line)` : '')
              }
              onClick={() => onTargetClick(target)}
              className={
                target.kind === 'edge'
                  ? 'text-violet-600 hover:bg-violet-100'
                  : 'text-sky-600 hover:bg-sky-100'
              }
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'transparent',
                border: 0,
                padding: 1,
                cursor: 'pointer',
                borderRadius: 3,
              }}
            >
              <LuTarget size={11} />
            </button>
          )}
        </td>
      );
    },
    [rightLineTargets, leftLineTargets, onTargetClick],
  );

  if (skip) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-neutral-500">
        No comparison active.
      </div>
    );
  }

  if (currentLoading || historicalLoading) {
    return (
      <div className="flex h-full items-center justify-center gap-2 text-xs text-neutral-500">
        <Loader size={12} /> Loading both TTL sides…
      </div>
    );
  }

  if (historicalError) {
    const status =
      historicalError && typeof historicalError === 'object' && 'status' in historicalError
        ? (historicalError as { status: number | string }).status
        : null;
    return (
      <div className="flex h-full items-center justify-center text-xs text-red-600">
        Failed to load historical TTL ({String(status ?? 'unknown')}).
      </div>
    );
  }

  return (
    <div ref={containerRef} className="ttl-diff-pane h-full overflow-auto">
      <ReactDiffViewer
        oldValue={historicalTtl ?? ''}
        newValue={currentTtl ?? ''}
        splitView
        compareMethod={DiffMethod.LINES}
        leftTitle={`@ ${compareSha?.slice(0, 7)} (historical)`}
        rightTitle="Current"
        useDarkTheme={false}
        renderGutter={renderGutter}
        styles={{
          contentText: {
            fontFamily:
              'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
            fontSize: '11.5px',
            lineHeight: '1.55',
            // No-wrap: long IRIs extend right and the parent div scrolls
            // horizontally. Avoids reflowing them onto multiple lines,
            // which made the diff unreadable on real GO-CAM files.
            whiteSpace: 'pre',
          },
          titleBlock: {
            fontSize: '11px',
            fontWeight: 600,
          },
        }}
      />
    </div>
  );
}
