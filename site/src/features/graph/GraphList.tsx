import { useEffect } from 'react';
import { NavLink, Skeleton, Stack } from '@mantine/core';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import {
  setSelectedGraphId,
  useGetGraphsQuery,
} from '@/features/graph';
import { clearSelection } from '@/features/ui';

export function GraphList() {
  const dispatch = useAppDispatch();
  const selectedGraphId = useAppSelector((s) => s.graph.selectedGraphId);
  const { data: list, isLoading, error } = useGetGraphsQuery();

  useEffect(() => {
    if (!list || list.length === 0) return;
    const present = list.some((g) => g.id === selectedGraphId);
    if (!present) {
      dispatch(setSelectedGraphId(list[0].id));
    }
  }, [list, selectedGraphId, dispatch]);

  if (isLoading) {
    return (
      <Stack gap={4} p="xs">
        <Skeleton h={28} />
        <Skeleton h={28} />
        <Skeleton h={28} />
      </Stack>
    );
  }

  if (error) {
    return (
      <p className="text-xs text-red-600 p-2.5">
        Failed to load graphs.
      </p>
    );
  }

  if (!list || list.length === 0) {
    return (
      <p className="text-xs text-neutral-500 p-2.5">
        No graphs available.
      </p>
    );
  }

  return (
    <Stack gap={2} p={4}>
      {list.map((g) => (
        <NavLink
          key={g.id}
          label={g.id}
          description={describeSummary(g)}
          active={g.id === selectedGraphId}
          onClick={() => {
            if (g.id !== selectedGraphId) {
              dispatch(setSelectedGraphId(g.id));
              dispatch(clearSelection());
            }
          }}
        />
      ))}
    </Stack>
  );
}

function describeSummary(g: { nodeCount: number; edgeCount: number; lastConvertedAt?: number | null }): string {
  const base = `${g.nodeCount} nodes · ${g.edgeCount} edges`;
  if (g.lastConvertedAt == null) return base;
  return `${base} · ${formatRelative(g.lastConvertedAt)}`;
}

function formatRelative(epochSeconds: number): string {
  const diff = Date.now() / 1000 - epochSeconds;
  if (diff < 0) return 'just now';
  if (diff < 60) return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}
