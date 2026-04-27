import { describe, expect, it } from 'vitest';
import {
  CYTOSCAPE_LAYOUT_OPTIONS,
  getCytoscapeLayout,
  type CytoscapeLayout,
} from '@/features/graph-cytoscape/layouts';

describe('getCytoscapeLayout', () => {
  it('returns a config whose name matches the requested algo', () => {
    for (const opt of CYTOSCAPE_LAYOUT_OPTIONS) {
      const cfg = getCytoscapeLayout(opt.value) as { name: string };
      expect(cfg.name).toBe(opt.value);
    }
  });

  it('falls back to breadthfirst on unknown algo', () => {
    const cfg = getCytoscapeLayout('does-not-exist') as { name: string };
    expect(cfg.name).toBe('breadthfirst');
  });

  it('every option is well-formed', () => {
    for (const opt of CYTOSCAPE_LAYOUT_OPTIONS) {
      expect(typeof opt.value).toBe('string');
      expect(typeof opt.label).toBe('string');
      expect(opt.label.length).toBeGreaterThan(0);
    }
  });

  it('the union type covers every dropdown value', () => {
    // Compile-time check via casting — fails the typecheck (not the test
    // runtime) if a new option's `value` isn't part of the CytoscapeLayout
    // union. Keeps the type and the dropdown in sync.
    const _values: CytoscapeLayout[] = CYTOSCAPE_LAYOUT_OPTIONS.map((o) => o.value);
    expect(_values.length).toBe(CYTOSCAPE_LAYOUT_OPTIONS.length);
  });
});
