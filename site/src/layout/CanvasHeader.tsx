import { ActionIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  LuChevronRight,
  LuGitCompareArrows,
  LuLayoutDashboard,
  LuMaximize,
  LuRefreshCw,
} from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { DiffBadge, openPicker } from '@/features/diff';
import { useGetGraphQuery, useGetGraphsQuery, useRebuildGraphMutation } from '@/features/graph';
import { clearSelection, requestFitView, requestRelayout } from '@/features/ui';
import { PanelHeader } from '@/layout/PanelHeader';

export function CanvasHeader() {
  const dispatch = useAppDispatch();
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const selectedNodeId = useAppSelector((s) => s.ui.selectedNodeId);
  const selectedEdgeId = useAppSelector((s) => s.ui.selectedEdgeId);
  const diffActive = useAppSelector((s) => s.diff.compareSha != null);
  const { data: list } = useGetGraphsQuery();
  const { data: graph } = useGetGraphQuery(graphId, { skip: !graphId });
  const [rebuildGraph, { isLoading: rebuilding }] = useRebuildGraphMutation();

  const summary = list?.find((g) => g.id === graphId);
  const nodeCount = graph?.nodes.length ?? summary?.nodeCount ?? 0;
  const edgeCount = graph?.edges.length ?? summary?.edgeCount ?? 0;

  const subtitle = graphId
    ? `${nodeCount} nodes · ${edgeCount} edges`
    : 'No graph loaded';

  const selectionLabel = (() => {
    if (!graph) return null;
    if (selectedEdgeId) {
      const edge = graph.edges.find((e) => e.id === selectedEdgeId);
      if (edge) return { kind: 'edge' as const, label: edge.label ?? edge.id };
    }
    if (selectedNodeId) {
      const node = graph.nodes.find((n) => n.id === selectedNodeId);
      if (node) return { kind: 'node' as const, label: node.label ?? node.id };
    }
    return null;
  })();

  const handleReload = async () => {
    if (!graphId) return;
    try {
      const res = await rebuildGraph({ id: graphId }).unwrap();
      notifications.show({
        color: res.ok ? 'teal' : 'red',
        title: res.ok ? 'Reloaded' : 'Reload failed',
        message: res.ok ? graphId : (res.error ?? 'Unknown error'),
        autoClose: res.ok ? 2000 : 5000,
      });
    } catch {
      notifications.show({
        color: 'red',
        title: 'Reload failed',
        message: 'Could not reach the conversion service',
        autoClose: 5000,
      });
    }
  };

  const title = (
    <span className="flex min-w-0 items-center gap-1.5">
      <span className="truncate">{graphId ?? 'No graph selected'}</span>
      {selectionLabel && (
        <>
          <LuChevronRight
            size={11}
            className="shrink-0"
            style={{ color: 'var(--color-text-dim)' }}
          />
          <button
            type="button"
            onClick={() => dispatch(clearSelection())}
            title="Clear selection (Esc)"
            className={`max-w-[200px] truncate rounded px-1.5 py-[1px] text-[11px] font-medium transition-colors ${
              selectionLabel.kind === 'edge'
                ? 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                : 'bg-sky-50 text-sky-700 hover:bg-sky-100'
            }`}
          >
            {selectionLabel.label}
          </button>
        </>
      )}
    </span>
  );

  return (
    <PanelHeader
      title={title}
      subtitle={subtitle}
      actions={
        <>
          {diffActive ? (
            <DiffBadge />
          ) : (
            <Tooltip label="Compare against history (Ctrl+D)" withArrow>
              <ActionIcon
                size="sm"
                variant="subtle"
                color="gray"
                aria-label="Compare against history"
                disabled={!graphId}
                onClick={() => dispatch(openPicker())}
              >
                <LuGitCompareArrows size={14} />
              </ActionIcon>
            </Tooltip>
          )}
          <Tooltip label="Fit view (F)" withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label="Fit view"
              onClick={() => dispatch(requestFitView())}
            >
              <LuMaximize size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Re-run layout (R)" withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label="Re-run layout"
              onClick={() => dispatch(requestRelayout())}
            >
              <LuLayoutDashboard size={14} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label="Reload from .ttl" withArrow>
            <ActionIcon
              size="sm"
              variant="subtle"
              color="gray"
              aria-label="Reload graph"
              loading={rebuilding}
              disabled={!graphId}
              onClick={handleReload}
            >
              <LuRefreshCw size={14} />
            </ActionIcon>
          </Tooltip>
        </>
      }
    />
  );
}
