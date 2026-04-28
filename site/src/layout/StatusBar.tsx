import { Tooltip } from '@mantine/core';
import { useAppSelector } from '@/app/hooks';
import { useGetGraphQuery, useGetGraphsQuery, useGetHealthQuery } from '@/features/graph';

export function StatusBar() {
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data, isFetching: graphFetching } = useGetGraphQuery(selectedGraphId, {
    skip: !selectedGraphId,
  });
  const { data: list } = useGetGraphsQuery();
  const summary = list?.find((g) => g.id === selectedGraphId);

  // Poll health every 30s — cheap heartbeat for the connection dot.
  const { data: health, isError: healthError, isFetching: healthFetching } = useGetHealthQuery(
    undefined,
    { pollingInterval: 30_000 },
  );

  const nodeCount = data?.nodes.length ?? summary?.nodeCount ?? 0;
  const edgeCount = data?.edges.length ?? summary?.edgeCount ?? 0;
  const lastConverted = summary?.lastConvertedAt;

  const apiState: 'ok' | 'warn' | 'down' = healthError
    ? 'down'
    : health?.status === 'ok'
      ? 'ok'
      : 'warn';
  const apiColor =
    apiState === 'ok'
      ? 'var(--color-status-ok)'
      : apiState === 'warn'
        ? 'var(--color-status-warn)'
        : 'var(--color-status-down)';
  const apiTooltip =
    apiState === 'ok'
      ? 'API connected'
      : apiState === 'warn'
        ? 'API reachable but unhealthy'
        : 'API unreachable';

  return (
    <div className="flex h-full flex-nowrap items-center justify-between gap-5 px-4">
      <div className="flex flex-nowrap items-center gap-4">
        <Tooltip label={apiTooltip} withArrow position="top">
          <span className="flex items-center gap-1.5 text-xs text-slate-500">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{
                background: apiColor,
                boxShadow: `0 0 0 2px ${apiColor}33`,
                opacity: healthFetching && !health ? 0.5 : 1,
              }}
            />
            {selectedGraphId ?? 'No graph selected'}
          </span>
        </Tooltip>
        <span className="text-xs tabular-nums text-slate-500">
          <span className="text-gray-900">{nodeCount}</span> nodes ·{' '}
          <span className="text-gray-900">{edgeCount}</span> edges
        </span>
        {graphFetching && (
          <span className="text-xs text-slate-400">loading…</span>
        )}
      </div>
      {lastConverted != null && (
        <Tooltip label={new Date(lastConverted * 1000).toLocaleString()} withArrow position="top">
          <span className="text-xs text-slate-500">
            converted {formatRelative(lastConverted)}
          </span>
        </Tooltip>
      )}
    </div>
  );
}

function formatRelative(epochSeconds: number): string {
  const diff = Date.now() / 1000 - epochSeconds;
  if (diff < 0) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
