import { describe, expect, it } from 'vitest';
import { diffAttrs } from '@/features/diff/services/diffAttrs';

describe('diffAttrs', () => {
  it('marks added / removed / unchanged / changed', () => {
    const before = { a: 1, b: 2, c: 3 };
    const after = { a: 1, b: 99, d: 4 };
    const rows = diffAttrs(before, after);
    const byKey = Object.fromEntries(rows.map((r) => [r.key, r.status]));
    expect(byKey.a).toBe('unchanged');
    expect(byKey.b).toBe('changed');
    expect(byKey.c).toBe('removed');
    expect(byKey.d).toBe('added');
  });

  it('stable-stringifies object values when comparing', () => {
    const before = { x: { a: 1, b: 2 } };
    const after = { x: { b: 2, a: 1 } };
    expect(diffAttrs(before, after).find((r) => r.key === 'x')?.status).toBe(
      'unchanged',
    );
  });

  it('handles undefined inputs', () => {
    expect(diffAttrs(undefined, { a: 1 })).toEqual([
      { key: 'a', status: 'added', before: undefined, after: 1 },
    ]);
    expect(diffAttrs({ a: 1 }, undefined)).toEqual([
      { key: 'a', status: 'removed', before: 1, after: undefined },
    ]);
  });

  it('returns rows sorted by key', () => {
    const rows = diffAttrs({ z: 1, a: 1 }, { z: 1, a: 1 });
    expect(rows.map((r) => r.key)).toEqual(['a', 'z']);
  });
});
