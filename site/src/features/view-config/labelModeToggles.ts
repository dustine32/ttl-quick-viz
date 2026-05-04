import type { LabelMode } from '@/features/view-config/viewConfigSlice';

// Three independent toggles — the canonical UI for label display:
//   showLabels — render the human label when one is available
//   showIds    — render the (CURIE or full) IRI
//   useFullIri — when showIds is on, use the full URL instead of the CURIE
export type LabelToggles = {
  showLabels: boolean;
  showIds: boolean;
  useFullIri: boolean;
};

// Project a LabelMode back to the three toggles. Used to drive the Switch UI
// from whatever mode is currently in the store.
export function modeToToggles(mode: LabelMode): LabelToggles {
  switch (mode) {
    case 'label-id':
      return { showLabels: true, showIds: true, useFullIri: false };
    case 'label-full':
      return { showLabels: true, showIds: true, useFullIri: true };
    case 'id-label':
      return { showLabels: true, showIds: true, useFullIri: false };
    case 'label':
      return { showLabels: true, showIds: false, useFullIri: false };
    case 'prefixed':
      return { showLabels: false, showIds: true, useFullIri: false };
    case 'full':
      return { showLabels: false, showIds: true, useFullIri: true };
  }
}

// Inverse: collapse the toggles to a LabelMode. Both-off falls back to
// 'prefixed' so the display never goes blank.
export function togglesToMode(t: LabelToggles): LabelMode {
  if (t.showLabels && t.showIds) return t.useFullIri ? 'label-full' : 'label-id';
  if (t.showLabels) return 'label';
  if (t.showIds) return t.useFullIri ? 'full' : 'prefixed';
  return 'prefixed';
}
