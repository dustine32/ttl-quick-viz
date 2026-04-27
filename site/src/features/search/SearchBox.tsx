import { useEffect, useMemo, useRef, useState } from 'react';
import { Kbd, Popover, SegmentedControl, TextInput } from '@mantine/core';
import { LuArrowRight, LuCircle, LuSearch, LuShare2 } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import { requestReveal, selectEdge, selectNode, setPaletteOpen } from '@/features/ui';
import { formatIri, selectLabelMode } from '@/features/view-config';

type NodeHit = {
  kind: 'node';
  id: string;
  display: string;
  sub: string;
  haystack: string;
};

type EdgeHit = {
  kind: 'edge';
  id: string;
  display: string;
  sub: string;
  haystack: string;
  sourceDisplay: string;
  targetDisplay: string;
  predicate: string;
};

type Hit = NodeHit | EdgeHit;
type SearchKind = 'all' | 'nodes' | 'edges';

const MAX_RESULTS = 50;
const NODE_BUDGET_IN_ALL = 30;

export function SearchBox() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.paletteOpen);
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const labelMode = useAppSelector(selectLabelMode);
  const { data } = useGetGraphQuery(graphId, { skip: !graphId });

  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<SearchKind>('all');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      inputRef.current?.blur();
    }
  }, [open]);

  const { nodeIndex, edgeIndex } = useMemo(() => {
    if (!data) return { nodeIndex: [] as NodeHit[], edgeIndex: [] as EdgeHit[] };
    const nodeDisplay = new Map<string, string>();
    const nodeHits: NodeHit[] = data.nodes.map((n) => {
      const display = formatIri(n.id, labelMode, { label: n.label });
      nodeDisplay.set(n.id, display);
      return {
        kind: 'node',
        id: n.id,
        display,
        sub: n.id,
        haystack: `${n.id}\n${n.label ?? ''}\n${display}`.toLowerCase(),
      };
    });
    const edgeHits: EdgeHit[] = data.edges.map((e) => {
      const sourceDisplay = nodeDisplay.get(e.source) ?? e.source;
      const targetDisplay = nodeDisplay.get(e.target) ?? e.target;
      const predicate = e.label ? formatIri(e.label, labelMode) : '—';
      const display = `${sourceDisplay} —[${predicate}]→ ${targetDisplay}`;
      return {
        kind: 'edge',
        id: e.id,
        display,
        sub: `${e.source} → ${e.target}`,
        haystack: `${e.label ?? ''}\n${predicate}\n${e.source}\n${e.target}\n${sourceDisplay}\n${targetDisplay}`.toLowerCase(),
        sourceDisplay,
        targetDisplay,
        predicate,
      };
    });
    return { nodeIndex: nodeHits, edgeIndex: edgeHits };
  }, [data, labelMode]);

  const { nodeMatches, edgeMatches } = useMemo(() => {
    const q = query.trim().toLowerCase();
    const matchFn = (h: Hit) => !q || h.haystack.includes(q);
    return {
      nodeMatches: nodeIndex.filter(matchFn),
      edgeMatches: edgeIndex.filter(matchFn),
    };
  }, [nodeIndex, edgeIndex, query]);

  const results: Hit[] = useMemo(() => {
    if (kind === 'nodes') return nodeMatches.slice(0, MAX_RESULTS);
    if (kind === 'edges') return edgeMatches.slice(0, MAX_RESULTS);
    // 'all' — guarantee some edges show even when nodes saturate the list.
    const ns = nodeMatches.slice(0, NODE_BUDGET_IN_ALL);
    const es = edgeMatches.slice(0, MAX_RESULTS - ns.length);
    return [...ns, ...es];
  }, [kind, nodeMatches, edgeMatches]);

  // Reset selection when the visible list changes — official React 19 "reset
  // state on prop change" pattern (no effect, no extra render).
  const resultsKey = `${kind}|${query}`;
  const [prevResultsKey, setPrevResultsKey] = useState(resultsKey);
  if (resultsKey !== prevResultsKey) {
    setPrevResultsKey(resultsKey);
    setActiveIdx(0);
  }

  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const close = () => {
    dispatch(setPaletteOpen(false));
  };

  const choose = (hit: Hit) => {
    if (hit.kind === 'node') {
      dispatch(selectNode(hit.id));
    } else {
      dispatch(selectEdge(hit.id));
    }
    dispatch(requestReveal());
    setQuery('');
    close();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const hit = results[activeIdx];
      if (hit) choose(hit);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };

  // Find indices where to render section headers (only in 'all' mode and when
  // both kinds are present).
  const showSectionHeaders =
    kind === 'all' &&
    results.some((h) => h.kind === 'node') &&
    results.some((h) => h.kind === 'edge');
  const firstEdgeIdx = showSectionHeaders
    ? results.findIndex((h) => h.kind === 'edge')
    : -1;

  const placeholder = !data
    ? 'Load a graph to search'
    : kind === 'edges'
      ? 'Search by predicate, source, or target…'
      : kind === 'nodes'
        ? 'Search nodes…'
        : 'Search nodes & edges…';

  return (
    <Popover
      opened={open}
      onChange={(o) => dispatch(setPaletteOpen(o))}
      position="bottom-start"
      width={560}
      shadow="xl"
      radius="md"
      withinPortal
      trapFocus={false}
      closeOnClickOutside
    >
      <Popover.Target>
        <TextInput
          ref={inputRef}
          size="xs"
          w={360}
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onFocus={() => dispatch(setPaletteOpen(true))}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label="Search nodes and edges"
          leftSection={<LuSearch />}
          rightSection={<Kbd size="xs">Ctrl+K</Kbd>}
          rightSectionWidth={64}
        />
      </Popover.Target>
      <Popover.Dropdown p={0} className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-neutral-200 bg-gradient-to-b from-neutral-50 to-white px-2.5 py-1.5">
          <SegmentedControl
            size="xs"
            value={kind}
            onChange={(v) => setKind(v as SearchKind)}
            data={[
              { label: `All · ${nodeMatches.length + edgeMatches.length}`, value: 'all' },
              { label: `Nodes · ${nodeMatches.length}`, value: 'nodes' },
              { label: `Edges · ${edgeMatches.length}`, value: 'edges' },
            ]}
          />
          {kind === 'all' && nodeMatches.length > NODE_BUDGET_IN_ALL && (
            <span className="text-[10.5px] text-neutral-400">
              top {NODE_BUDGET_IN_ALL} nodes shown
            </span>
          )}
        </div>
        <div ref={listRef} className="max-h-[62vh] overflow-y-auto bg-white">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-neutral-400">
              {!data
                ? 'No graph selected.'
                : query.trim()
                  ? `No ${kind === 'all' ? 'matches' : kind} for "${query.trim()}".`
                  : `No ${kind === 'all' ? 'results' : kind}.`}
            </div>
          ) : (
            results.map((hit, i) => {
              const active = i === activeIdx;
              return (
                <div key={`${hit.kind}:${hit.id}`}>
                  {i === 0 && showSectionHeaders && (
                    <SectionHeader label="Nodes" count={nodeMatches.length} />
                  )}
                  {i === firstEdgeIdx && (
                    <SectionHeader label="Edges" count={edgeMatches.length} />
                  )}
                  <button
                    data-idx={i}
                    type="button"
                    onMouseEnter={() => setActiveIdx(i)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => choose(hit)}
                    className={`flex w-full items-start gap-2.5 px-3 py-1.5 text-left transition-colors ${active
                      ? 'bg-sky-50 ring-1 ring-inset ring-sky-200/70'
                      : 'hover:bg-neutral-50'
                      }`}
                  >
                    {hit.kind === 'node' ? (
                      <span
                        className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-700"
                        aria-hidden
                      >
                        <LuCircle size={10} fill="currentColor" />
                      </span>
                    ) : (
                      <span
                        className="mt-[3px] flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700"
                        aria-hidden
                      >
                        <LuShare2 size={11} />
                      </span>
                    )}
                    <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                      {hit.kind === 'node' ? (
                        <>
                          <span className="truncate text-xs font-medium text-neutral-800">
                            {hit.display}
                          </span>
                          {hit.sub !== hit.display && (
                            <span className="truncate text-xs text-neutral-500">
                              {hit.sub}
                            </span>
                          )}
                        </>
                      ) : (
                        <EdgeRowDisplay hit={hit} />
                      )}
                    </span>
                  </button>
                </div>
              );
            })
          )}
        </div>
        <div className="flex items-center gap-3 border-t border-neutral-200 bg-neutral-50/70 px-3 py-1.5 text-[10.5px] text-neutral-500">
          <span>
            <Kbd size="xs">↑↓</Kbd> navigate
          </span>
          <span>
            <Kbd size="xs">↵</Kbd> select
          </span>
          <span>
            <Kbd size="xs">Esc</Kbd> close
          </span>
          <span className="ml-auto tabular-nums text-neutral-400">
            {results.length}/{kind === 'all' ? nodeMatches.length + edgeMatches.length : kind === 'nodes' ? nodeMatches.length : edgeMatches.length}
          </span>
        </div>
      </Popover.Dropdown>
    </Popover>
  );
}

function SectionHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-10 flex items-center justify-between border-y border-neutral-100 bg-neutral-50/95 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-neutral-500 backdrop-blur">
      <span>{label}</span>
      <span className="tabular-nums text-neutral-400">{count}</span>
    </div>
  );
}

function EdgeRowDisplay({ hit }: { hit: EdgeHit }) {
  return (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-neutral-800">
        <span className="max-w-[40%] truncate rounded bg-neutral-100 px-1.5 py-px font-medium text-neutral-700">
          {hit.sourceDisplay}
        </span>
        <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-violet-700">
          {hit.predicate}
          <LuArrowRight size={11} />
        </span>
        <span className="max-w-[40%] truncate rounded bg-neutral-100 px-1.5 py-px font-medium text-neutral-700">
          {hit.targetDisplay}
        </span>
      </span>
      <span className="truncate text-[10.5px] text-neutral-400">{hit.sub}</span>
    </>
  );
}
