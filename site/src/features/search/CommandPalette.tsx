import { useEffect, useMemo, useRef, useState } from 'react';
import { Modal, TextInput } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery } from '@/features/graph';
import { requestReveal, selectNode, setPaletteOpen } from '@/features/ui';
import { formatIri, selectLabelMode } from '@/features/view-config';

type Hit = {
  id: string;
  label?: string;
  display: string;
  sub: string;
};

const MAX_RESULTS = 50;

function buildHaystack(hit: Hit): string {
  return `${hit.id}\n${hit.label ?? ''}\n${hit.display}`.toLowerCase();
}

export function CommandPalette() {
  const dispatch = useAppDispatch();
  const open = useAppSelector((s) => s.ui.paletteOpen);
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const labelMode = useAppSelector(selectLabelMode);
  const { data } = useGetGraphQuery(graphId, { skip: !graphId });

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setActiveIdx(0);
    }
  }, [open]);

  const index: Hit[] = useMemo(() => {
    if (!data) return [];
    return data.nodes.map((n) => ({
      id: n.id,
      label: n.label ?? undefined,
      display: formatIri(n.id, labelMode, { label: n.label }),
      sub: n.id,
    }));
  }, [data, labelMode]);

  const results: Hit[] = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return index.slice(0, MAX_RESULTS);
    const filtered: Hit[] = [];
    for (const h of index) {
      if (buildHaystack(h).includes(q)) {
        filtered.push(h);
        if (filtered.length >= MAX_RESULTS) break;
      }
    }
    return filtered;
  }, [index, query]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const close = () => dispatch(setPaletteOpen(false));

  const choose = (hit: Hit) => {
    dispatch(selectNode(hit.id));
    dispatch(requestReveal());
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
    }
  };

  return (
    <Modal
      opened={open}
      onClose={close}
      withCloseButton={false}
      padding={0}
      size="lg"
      centered
      yOffset="8rem"
      overlayProps={{ backgroundOpacity: 0.3, blur: 2 }}
    >
      <div className="flex flex-col">
        <TextInput
          value={query}
          onChange={(e) => setQuery(e.currentTarget.value)}
          onKeyDown={onKeyDown}
          autoFocus
          placeholder={data ? 'Search nodes by label, id, or IRI…' : 'Load a graph to search'}
          size="md"
          variant="unstyled"
          styles={{
            input: {
              padding: '14px 16px',
              fontSize: 15,
              borderBottom: '1px solid var(--mantine-color-gray-3)',
            },
          }}
        />
        <div
          ref={listRef}
          className="max-h-[50vh] overflow-y-auto"
        >
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-neutral-400">
              {data ? 'No matches.' : 'No graph selected.'}
            </div>
          ) : (
            results.map((hit, i) => {
              const active = i === activeIdx;
              return (
                <button
                  key={hit.id}
                  type="button"
                  onMouseEnter={() => setActiveIdx(i)}
                  onClick={() => choose(hit)}
                  className={`flex w-full flex-col gap-0.5 px-4 py-2 text-left ${
                    active ? 'bg-blue-50' : 'hover:bg-neutral-50'
                  }`}
                >
                  <span className="text-sm font-medium text-neutral-800 truncate">
                    {hit.display}
                  </span>
                  {hit.sub !== hit.display && (
                    <span className="text-xs text-neutral-500 truncate">{hit.sub}</span>
                  )}
                </button>
              );
            })
          )}
        </div>
        <div className="border-t border-neutral-200 px-3 py-1.5 text-[11px] text-neutral-500 flex items-center gap-3">
          <span>↑↓ navigate</span>
          <span>↵ select</span>
          <span>Esc close</span>
          <span className="ml-auto tabular-nums">
            {results.length} {results.length === 1 ? 'match' : 'matches'}
          </span>
        </div>
      </div>
    </Modal>
  );
}
