export type AttrDiffStatus = 'added' | 'removed' | 'changed' | 'unchanged';

export type AttrDiffRow = {
  key: string;
  status: AttrDiffStatus;
  before: unknown;
  after: unknown;
};

const stable = (v: unknown): string => {
  if (v == null) return '';
  if (typeof v === 'object') {
    return JSON.stringify(v, Object.keys(v as object).sort());
  }
  return String(v);
};

export function diffAttrs(
  before: Record<string, unknown> | undefined,
  after: Record<string, unknown> | undefined,
): AttrDiffRow[] {
  const b = before ?? {};
  const a = after ?? {};
  const keys = new Set([...Object.keys(b), ...Object.keys(a)]);
  const rows: AttrDiffRow[] = [];
  for (const key of [...keys].sort()) {
    const inB = key in b;
    const inA = key in a;
    if (inB && !inA) {
      rows.push({ key, status: 'removed', before: b[key], after: undefined });
    } else if (!inB && inA) {
      rows.push({ key, status: 'added', before: undefined, after: a[key] });
    } else {
      const same = stable(b[key]) === stable(a[key]);
      rows.push({
        key,
        status: same ? 'unchanged' : 'changed',
        before: b[key],
        after: a[key],
      });
    }
  }
  return rows;
}
