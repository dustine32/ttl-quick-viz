import { describe, expect, it } from 'vitest';
import {
  diffReducer,
  openPicker,
  closePicker,
  setCompare,
  clearCompare,
} from '@/features/diff/slices/diffSlice';
import { setSelectedGraphId } from '@/features/graph/slices/graphSlice';
import type { Graph } from '@/features/graph/types';

const empty: Graph = { nodes: [], edges: [] };

const withOneNode = (id: string, attrs: Record<string, unknown> = {}): Graph => ({
  nodes: [{ id, attrs }],
  edges: [],
});

describe('diffSlice', () => {
  const initial = diffReducer(undefined, { type: '@@INIT' });

  it('starts closed with no compare', () => {
    expect(initial.pickerOpen).toBe(false);
    expect(initial.compareSha).toBeNull();
    expect(initial.compareGraph).toBeNull();
    expect(initial.diffMap).toBeNull();
  });

  it('openPicker / closePicker toggle pickerOpen', () => {
    let state = diffReducer(initial, openPicker());
    expect(state.pickerOpen).toBe(true);
    state = diffReducer(state, closePicker());
    expect(state.pickerOpen).toBe(false);
  });

  it('setCompare stores sha + graph and computes diffMap', () => {
    const current = withOneNode('a', { x: 1 });
    const compare = withOneNode('a', { x: 2 });
    const state = diffReducer(
      initial,
      setCompare({
        sha: 'abc1234',
        subject: 'release v2',
        compareGraph: compare,
        currentGraph: current,
      }),
    );
    expect(state.compareSha).toBe('abc1234');
    expect(state.compareSubject).toBe('release v2');
    expect(state.compareGraph).toEqual(compare);
    expect(state.diffMap?.nodes.a).toBe('changed');
    expect(state.pickerOpen).toBe(false);
  });

  it('clearCompare wipes the compare state', () => {
    const state1 = diffReducer(
      initial,
      setCompare({
        sha: 'abc1234',
        subject: 's',
        compareGraph: empty,
        currentGraph: empty,
      }),
    );
    const state2 = diffReducer(state1, clearCompare());
    expect(state2.compareSha).toBeNull();
    expect(state2.compareGraph).toBeNull();
    expect(state2.diffMap).toBeNull();
  });

  it('clears diff state when the selected graph id changes', () => {
    const state1 = diffReducer(
      initial,
      setCompare({
        sha: 'abc1234',
        subject: 's',
        compareGraph: empty,
        currentGraph: empty,
      }),
    );
    expect(state1.compareSha).toBe('abc1234');
    const state2 = diffReducer(state1, setSelectedGraphId('different-model'));
    expect(state2.compareSha).toBeNull();
    expect(state2.compareGraph).toBeNull();
    expect(state2.diffMap).toBeNull();
    expect(state2.pickerOpen).toBe(false);
  });
});
