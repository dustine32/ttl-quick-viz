import { ActionIcon, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import {
  LuLayoutDashboard,
  LuMaximize,
  LuRefreshCw,
} from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { useGetGraphQuery, useGetGraphsQuery, useRebuildGraphMutation } from '@/features/graph';
import { requestFitView, requestRelayout } from '@/features/ui';
import { PanelHeader } from '@/layout/PanelHeader';

export function CanvasHeader() {
  const dispatch = useAppDispatch();
  const graphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data: list } = useGetGraphsQuery();
  const { data: graph } = useGetGraphQuery(graphId, { skip: !graphId });
  const [rebuildGraph, { isLoading: rebuilding }] = useRebuildGraphMutation();

  const summary = list?.find((g) => g.id === graphId);
  const nodeCount = graph?.nodes.length ?? summary?.nodeCount ?? 0;
  const edgeCount = graph?.edges.length ?? summary?.edgeCount ?? 0;

  const subtitle = graphId
    ? `${nodeCount} nodes · ${edgeCount} edges`
    : 'No graph loaded';

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

  return (
    <PanelHeader
      title={graphId ?? 'No graph selected'}
      subtitle={subtitle}
      actions={
        <>
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
