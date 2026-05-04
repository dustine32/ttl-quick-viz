export type { LabelsState } from '@/features/labels/labelsSlice';
export {
  labelsSlice,
  labelsReducer,
  addResolvedLabels,
  clearResolvedLabels,
  LABELS_STORAGE_KEY,
} from '@/features/labels/labelsSlice';
export {
  selectLabelsByIri,
  selectResolvedLabel,
} from '@/features/labels/selectors';
export {
  useResolvedLabel,
  useLabelResolver,
  type LabelResolver,
} from '@/features/labels/useResolvedLabel';
export { iriToCurie, curieToIri } from '@/features/labels/iriToCurie';
export { useLabelsBootstrap } from '@/features/labels/useLabelsBootstrap';
export { resolveLabels } from '@/features/labels/golrClient';
export type { ResolveResult } from '@/features/labels/golrClient';
export { ResolveLabelsButton } from '@/features/labels/ResolveLabelsButton';
export { useFormatIri } from '@/features/labels/useFormatIri';
export type { FormatIriFn } from '@/features/labels/useFormatIri';
export type { PrefixMap } from '@/features/labels/data/prefix-map';
export { GO_CONTEXT } from '@/features/labels/data/prefix-map';
