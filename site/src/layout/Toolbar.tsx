import { ActionIcon, Menu, SegmentedControl, Select, Tooltip } from '@mantine/core';
import { notifications } from '@mantine/notifications';
import { useState } from 'react';
import {
  LuCheck,
  LuDownload,
  LuEllipsis,
  LuLink,
  LuNetwork,
  LuRefreshCw,
} from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { setRenderer, type GraphRenderer, useConvertAllMutation } from '@/features/graph';
import { SearchBox } from '@/features/search';
import {
  LayoutPicker,
  selectStandaloneMode,
  setStandaloneMode,
  type StandaloneMode,
} from '@/features/view-config';

export function Toolbar() {
  const dispatch = useAppDispatch();
  const renderer = useAppSelector((s) => s.graph.renderer);
  const standaloneMode = useAppSelector(selectStandaloneMode);
  const [copied, setCopied] = useState(false);
  const [convertAll, { isLoading: rebuilding }] = useConvertAllMutation();
  const layoutVisible =
    standaloneMode !== 'only' && (renderer === 'xyflow' || renderer === 'cytoscape');

  const handleRebuildAll = async () => {
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
    <div className="flex h-full flex-nowrap items-center justify-between gap-5 px-4">
      {/* Brand */}
      <div className="flex min-w-[200px] flex-nowrap items-center gap-2.5">
        <div
          className="flex h-7 w-7 items-center justify-center rounded-md text-white"
          style={{ background: 'var(--color-accent)' }}
        >
          <LuNetwork size={15} />
        </div>
        <div className="flex items-baseline gap-2">
          <h1 className="m-0 text-sm font-semibold tracking-tight text-gray-900">
            TTL Quick Viz
          </h1>
          <span
            className="rounded px-1.5 py-[1px] text-[9.5px] font-semibold uppercase tracking-wider"
            style={{
              background: 'var(--color-accent-soft)',
              color: 'var(--color-accent)',
            }}
          >
            Beta
          </span>
        </div>
      </div>

      {/* Search */}
      <div className="flex flex-1 flex-nowrap items-center justify-center gap-3">
        <SearchBox />
      </div>

      {/* Right cluster: canvas-config pill, then global actions */}
      <div className="flex flex-nowrap items-center gap-2">
        <div className="toolbar-cluster">
          <Tooltip label="Standalone nodes" withArrow openDelay={400}>
            <SegmentedControl
              size="xs"
              value={standaloneMode}
              aria-label="Standalone nodes"
              data={[
                { value: 'hide', label: 'Connected' },
                { value: 'both', label: 'All' },
                { value: 'only', label: 'Orphans' },
              ]}
              onChange={(v) => dispatch(setStandaloneMode(v as StandaloneMode))}
            />
          </Tooltip>
          <Select
            size="xs"
            w={130}
            value={renderer}
            allowDeselect={false}
            aria-label="Renderer"
            disabled={standaloneMode === 'only'}
            data={[
              { value: 'xyflow', label: 'React Flow' },
              { value: 'cytoscape', label: 'Cytoscape' },
              { value: 'force', label: 'Force 2D' },
              { value: 'force3d', label: 'Force 3D' },
              { value: 'sigma', label: 'Sigma (WebGL)' },
              { value: 'graphin', label: 'Graphin (G6)' },
              { value: 'tree', label: 'Tree / Mind map' },
            ]}
            onChange={(v) => {
              if (v) dispatch(setRenderer(v as GraphRenderer));
            }}
          />
          {layoutVisible && <LayoutPicker />}
        </div>

        <Tooltip label="Rebuild all graphs (Shift+R)" withArrow>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Rebuild all graphs"
            onClick={handleRebuildAll}
            loading={rebuilding}
          >
            <LuRefreshCw size={16} />
          </ActionIcon>
        </Tooltip>

        <Menu position="bottom-end" shadow="md" width={220}>
          <Menu.Target>
            <Tooltip label="More" withArrow>
              <ActionIcon variant="subtle" color="gray" aria-label="More actions">
                <LuEllipsis />
              </ActionIcon>
            </Tooltip>
          </Menu.Target>
          <Menu.Dropdown>
            <Menu.Label>Share</Menu.Label>
            <Menu.Item
              leftSection={copied ? <LuCheck size={14} /> : <LuLink size={14} />}
              onClick={copyLink}
              color={copied ? 'teal' : undefined}
            >
              {copied ? 'Link copied' : 'Copy shareable link'}
            </Menu.Item>
            <Menu.Item
              leftSection={<LuDownload size={14} />}
              disabled
              rightSection={<span className="text-[10px] text-neutral-500">soon</span>}
            >
              Export image
            </Menu.Item>
          </Menu.Dropdown>
        </Menu>
      </div>
    </div>
  );
}
