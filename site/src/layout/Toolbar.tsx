import {
  ActionIcon,
  Burger,
  Divider,
  Group,
  Select,
  Tooltip,
} from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setRenderer, type GraphRenderer, useConvertAllMutation } from '@/features/graph';
import { LayoutPicker } from '@/features/view-config';
import {
  requestFitView,
  requestRelayout,
  setPaletteOpen,
  toggleLeftPanel,
  toggleRightPanel,
} from '@/features/ui';
import {
  IconDownload,
  IconFitView,
  IconLayout,
  IconLink,
  IconPanelRight,
  IconRefresh,
  IconSearch,
} from '@/layout/icons';

export function Toolbar() {
  const dispatch = useAppDispatch();
  const renderer = useAppSelector((s) => s.graph.renderer);
  const leftPanelOpen = useAppSelector((s) => s.ui.leftPanelOpen);
  const rightPanelOpen = useAppSelector((s) => s.ui.rightPanelOpen);
  const [copied, setCopied] = useState(false);
  const [convertAll, { isLoading: rebuilding }] = useConvertAllMutation();

  const handleRebuild = async () => {
    try {
      const res = await convertAll().unwrap();
      const failed = res.results.filter((r) => !r.ok);
      if (res.errorCount === 0) {
        notifications.show({
          color: 'teal',
          title: 'Rebuild complete',
          message: `${res.okCount} converted, ${res.skippedCount} skipped`,
          autoClose: 3000,
        });
      } else {
        notifications.show({
          color: 'red',
          title: `Rebuild: ${res.errorCount} failed`,
          message: failed
            .slice(0, 3)
            .map((r) => `${r.id}: ${r.error}`)
            .join('\n'),
          autoClose: 6000,
        });
      }
    } catch (err) {
      const detail =
        err && typeof err === 'object' && 'data' in err && err.data && typeof err.data === 'object'
          ? (err.data as { detail?: string }).detail
          : undefined;
      notifications.show({
        color: 'red',
        title: 'Rebuild failed',
        message: detail ?? 'Could not reach the conversion service',
        autoClose: 6000,
      });
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — ignore */
    }
  };

  return (
    <Group h="100%" px="sm" gap="sm" wrap="nowrap" justify="space-between">
      <Group gap="sm" wrap="nowrap">
        <Burger
          size="sm"
          opened={leftPanelOpen}
          onClick={() => dispatch(toggleLeftPanel())}
          aria-label="Toggle left panel"
        />
        <h1 className="m-0 text-sm font-semibold tracking-tight text-neutral-800">
          TTL Quick Viz
        </h1>
      </Group>

      <Group gap="xs" wrap="nowrap" align="center">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
          Renderer
        </span>
        <Select
          size="xs"
          w={150}
          value={renderer}
          allowDeselect={false}
          aria-label="Renderer"
          data={[
            { value: 'xyflow', label: 'React Flow' },
            { value: 'cytoscape', label: 'Cytoscape' },
            { value: 'force', label: 'Force 2D' },
            { value: 'force3d', label: 'Force 3D' },
            { value: 'sigma', label: 'Sigma (WebGL)' },
            { value: 'graphin', label: 'Graphin (G6)' },
          ]}
          onChange={(v) => {
            if (v) dispatch(setRenderer(v as GraphRenderer));
          }}
        />
        {(renderer === 'xyflow' || renderer === 'cytoscape') && (
          <>
            <Divider orientation="vertical" mx={2} />
            <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
              Layout
            </span>
            <LayoutPicker />
          </>
        )}
      </Group>

      <Group gap={4} wrap="nowrap">
        <Tooltip label="Rebuild all graphs from .ttl (Shift+R)">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Rebuild all graphs"
            loading={rebuilding}
            onClick={handleRebuild}
          >
            <IconRefresh />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Search nodes (Ctrl+K)">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Search nodes"
            onClick={() => dispatch(setPaletteOpen(true))}
          >
            <IconSearch />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Fit view (F)">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Fit view"
            onClick={() => dispatch(requestFitView())}
          >
            <IconFitView />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Re-run layout (R)">
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Re-run layout"
            onClick={() => dispatch(requestRelayout())}
          >
            <IconLayout />
          </ActionIcon>
        </Tooltip>
        <Tooltip label={copied ? 'Copied!' : 'Copy shareable link'}>
          <ActionIcon
            variant="subtle"
            color={copied ? 'teal' : 'gray'}
            aria-label="Copy shareable link"
            onClick={copyLink}
          >
            <IconLink />
          </ActionIcon>
        </Tooltip>
        <Tooltip label="Export (coming soon)">
          <ActionIcon variant="subtle" color="gray" aria-label="Export" disabled>
            <IconDownload />
          </ActionIcon>
        </Tooltip>
        <Divider orientation="vertical" mx={4} />
        <Tooltip label="Toggle right panel (Ctrl+Alt+B)">
          <ActionIcon
            variant={rightPanelOpen ? 'light' : 'subtle'}
            color="gray"
            aria-label="Toggle right panel"
            onClick={() => dispatch(toggleRightPanel())}
          >
            <IconPanelRight />
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
}
