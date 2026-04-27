import {
  treeReducer,
  toggleCollapsed,
  expandAll,
  setOrientation,
  type TreeState,
} from '@/features/graph-tree/treeSlice';

const initial: TreeState = { collapsedIds: [], orientation: 'DOWN' };

describe('treeSlice', () => {
  it('toggles a collapsed id on and off', () => {
    const a = treeReducer(initial, toggleCollapsed('x'));
    expect(a.collapsedIds).toEqual(['x']);
    const b = treeReducer(a, toggleCollapsed('x'));
    expect(b.collapsedIds).toEqual([]);
  });

  it('expandAll clears all collapsed ids', () => {
    const seeded: TreeState = { ...initial, collapsedIds: ['a', 'b', 'c'] };
    const out = treeReducer(seeded, expandAll());
    expect(out.collapsedIds).toEqual([]);
  });

  it('setOrientation updates the orientation', () => {
    const out = treeReducer(initial, setOrientation('RIGHT'));
    expect(out.orientation).toBe('RIGHT');
    const back = treeReducer(out, setOrientation('DOWN'));
    expect(back.orientation).toBe('DOWN');
  });

  it('toggling preserves order across multiple ids', () => {
    let s = treeReducer(initial, toggleCollapsed('a'));
    s = treeReducer(s, toggleCollapsed('b'));
    s = treeReducer(s, toggleCollapsed('c'));
    expect(s.collapsedIds).toEqual(['a', 'b', 'c']);
    s = treeReducer(s, toggleCollapsed('b'));
    expect(s.collapsedIds).toEqual(['a', 'c']);
  });
});
