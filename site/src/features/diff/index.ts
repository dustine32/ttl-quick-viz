// Slice
export {
  diffSlice,
  diffReducer,
  openPicker,
  closePicker,
  setCompare,
  clearCompare,
} from '@/features/diff/slices/diffSlice';
export type { DiffState } from '@/features/diff/slices/diffSlice';

// Services (pure helpers)
export { computeDiff, edgeKey } from '@/features/diff/services/computeDiff';
export type { DiffMap, DiffStatus } from '@/features/diff/services/computeDiff';
export { diffAttrs } from '@/features/diff/services/diffAttrs';
export type { AttrDiffRow, AttrDiffStatus } from '@/features/diff/services/diffAttrs';
export { diffStyleFor } from '@/features/diff/services/diffStyling';
export type { DiffStyle } from '@/features/diff/services/diffStyling';

// Hooks
export { useDiffOverlay } from '@/features/diff/hooks/useDiffOverlay';
export type { DiffOverlay } from '@/features/diff/hooks/useDiffOverlay';

// Components
export { DiffPicker } from '@/features/diff/components/DiffPicker';
export { DiffBadge } from '@/features/diff/components/DiffBadge';
export { DiffAttrsView } from '@/features/diff/components/DiffAttrsView';
