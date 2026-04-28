import { Modal } from '@mantine/core';

type Row = { keys: string[]; label: string };

const PANEL_SHORTCUTS: Row[] = [
  { keys: ['Ctrl', 'B'], label: 'Toggle Graphs panel' },
  { keys: ['Ctrl', 'Alt', 'B'], label: 'Toggle Inspector / View panel' },
  { keys: ['Ctrl', 'J'], label: 'Toggle TTL source pane' },
  { keys: ['Ctrl', 'K'], label: 'Open command palette' },
];

const GRAPH_SHORTCUTS: Row[] = [
  { keys: ['F'], label: 'Fit view' },
  { keys: ['R'], label: 'Re-run layout' },
  { keys: ['Esc'], label: 'Clear selection' },
];

const DATA_SHORTCUTS: Row[] = [
  { keys: ['Ctrl', 'D'], label: 'Compare against history' },
  { keys: ['Shift', 'R'], label: 'Rebuild all graphs' },
];

type Props = { opened: boolean; onClose: () => void };

export function ShortcutsModal({ opened, onClose }: Props) {
  return (
    <Modal opened={opened} onClose={onClose} title="Keyboard shortcuts" size="md" centered>
      <Section title="Panels" rows={PANEL_SHORTCUTS} />
      <Section title="Graph" rows={GRAPH_SHORTCUTS} />
      <Section title="Data" rows={DATA_SHORTCUTS} />
    </Modal>
  );
}

function Section({ title, rows }: { title: string; rows: Row[] }) {
  return (
    <div className="mb-4 last:mb-0">
      <div
        className="mb-2 text-[11px] font-semibold uppercase tracking-[0.4px]"
        style={{ color: 'var(--color-text-muted)' }}
      >
        {title}
      </div>
      <div className="flex flex-col gap-1.5">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center justify-between gap-3">
            <span className="text-sm text-gray-800">{r.label}</span>
            <div className="flex flex-nowrap items-center gap-1">
              {r.keys.map((k, i) => (
                <span key={i} className="flex items-center gap-1">
                  <kbd
                    className="rounded border px-1.5 py-[1px] text-[10px] font-medium tabular-nums"
                    style={{
                      background: 'var(--color-panel-elev)',
                      borderColor: 'var(--color-border)',
                      color: 'var(--color-text)',
                    }}
                  >
                    {k}
                  </kbd>
                  {i < r.keys.length - 1 && (
                    <span className="text-[10px] text-gray-400">+</span>
                  )}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
