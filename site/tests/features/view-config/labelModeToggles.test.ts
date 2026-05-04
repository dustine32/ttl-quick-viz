import {
  modeToToggles,
  togglesToMode,
} from '@/features/view-config/labelModeToggles';
import type { LabelMode } from '@/features/view-config/viewConfigSlice';

describe('togglesToMode', () => {
  it('labels + ids + curie => label-id', () => {
    expect(togglesToMode({ showLabels: true, showIds: true, useFullIri: false })).toBe(
      'label-id',
    );
  });

  it('labels + ids + full IRI => label-full', () => {
    expect(togglesToMode({ showLabels: true, showIds: true, useFullIri: true })).toBe(
      'label-full',
    );
  });

  it('labels only => label', () => {
    expect(togglesToMode({ showLabels: true, showIds: false, useFullIri: false })).toBe(
      'label',
    );
    expect(togglesToMode({ showLabels: true, showIds: false, useFullIri: true })).toBe(
      'label',
    );
  });

  it('ids only + curie => prefixed', () => {
    expect(togglesToMode({ showLabels: false, showIds: true, useFullIri: false })).toBe(
      'prefixed',
    );
  });

  it('ids only + full IRI => full', () => {
    expect(togglesToMode({ showLabels: false, showIds: true, useFullIri: true })).toBe(
      'full',
    );
  });

  it('both off falls back to prefixed (so display never goes blank)', () => {
    expect(togglesToMode({ showLabels: false, showIds: false, useFullIri: false })).toBe(
      'prefixed',
    );
  });
});

describe('modeToToggles', () => {
  const cases: { mode: LabelMode; expected: ReturnType<typeof modeToToggles> }[] = [
    { mode: 'label-id', expected: { showLabels: true, showIds: true, useFullIri: false } },
    { mode: 'label-full', expected: { showLabels: true, showIds: true, useFullIri: true } },
    { mode: 'label', expected: { showLabels: true, showIds: false, useFullIri: false } },
    { mode: 'prefixed', expected: { showLabels: false, showIds: true, useFullIri: false } },
    { mode: 'full', expected: { showLabels: false, showIds: true, useFullIri: true } },
    { mode: 'id-label', expected: { showLabels: true, showIds: true, useFullIri: false } },
  ];

  for (const { mode, expected } of cases) {
    it('projects ' + mode + ' to the right toggles', () => {
      expect(modeToToggles(mode)).toEqual(expected);
    });
  }
});

describe('round-trip', () => {
  // The 5 "canonical" modes round-trip; id-label collapses to label-id which
  // is fine — the toggles can't express "ID first", and that's a deliberate
  // simplification.
  const canonical: LabelMode[] = ['label-id', 'label-full', 'label', 'prefixed', 'full'];
  for (const mode of canonical) {
    it(mode + ' round-trips through toggles', () => {
      expect(togglesToMode(modeToToggles(mode))).toBe(mode);
    });
  }
});
