import type { DiffStatus } from '@/features/diff/services/computeDiff';

export type DiffStyle = {
  stroke: string;
  fill: string;
  opacity: number;
  dashed: boolean;
  label: string;
};

const STYLES: Record<DiffStatus, DiffStyle> = {
  added: {
    stroke: '#16a34a', // green-600
    fill: '#86efac', // green-300
    opacity: 1,
    dashed: false,
    label: 'Added',
  },
  removed: {
    stroke: '#dc2626', // red-600
    fill: '#fca5a5', // red-300
    opacity: 1,
    dashed: true,
    label: 'Removed',
  },
  changed: {
    stroke: '#d97706', // amber-600
    fill: '#fcd34d', // amber-300
    opacity: 1,
    dashed: false,
    label: 'Changed',
  },
  unchanged: {
    // Strong dim so diff elements pop. Treat unchanged as background scaffolding.
    stroke: '#94a3b8', // slate-400
    fill: '#e5e7eb', // neutral-200
    opacity: 0.18,
    dashed: false,
    label: 'Unchanged',
  },
};

export function diffStyleFor(status: DiffStatus): DiffStyle {
  return STYLES[status];
}
