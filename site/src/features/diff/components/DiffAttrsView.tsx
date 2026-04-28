import { Badge } from '@mantine/core';
import type { AttrDiffRow } from '@/features/diff/services/diffAttrs';

const renderValue = (v: unknown): string => {
  if (v == null) return '∅';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
};

export function DiffAttrsView({ rows }: { rows: AttrDiffRow[] }) {
  if (rows.length === 0) {
    return <p className="text-xs text-neutral-500">No attributes.</p>;
  }
  return (
    <div className="flex flex-col gap-1">
      {rows.map((row) => (
        <div
          key={row.key}
          className="flex flex-col gap-0.5 rounded border border-neutral-200 px-2 py-1"
        >
          <div className="flex flex-nowrap items-center gap-1.5">
            <Badge
              size="xs"
              variant="light"
              color={
                row.status === 'added'
                  ? 'green'
                  : row.status === 'removed'
                    ? 'red'
                    : row.status === 'changed'
                      ? 'yellow'
                      : 'gray'
              }
            >
              {row.status}
            </Badge>
            <span className="break-all text-xs font-medium">{row.key}</span>
          </div>
          {row.status === 'changed' && (
            <div className="flex flex-col gap-0.5 pl-2">
              <span className="break-all text-[11px] text-red-700">
                <span className="text-neutral-500">before:</span> {renderValue(row.before)}
              </span>
              <span className="break-all text-[11px] text-green-700">
                <span className="text-neutral-500">after:</span> {renderValue(row.after)}
              </span>
            </div>
          )}
          {row.status === 'added' && (
            <span className="break-all pl-2 text-[11px] text-green-700">
              {renderValue(row.after)}
            </span>
          )}
          {row.status === 'removed' && (
            <span className="break-all pl-2 text-[11px] text-red-700">
              {renderValue(row.before)}
            </span>
          )}
          {row.status === 'unchanged' && (
            <span className="break-all pl-2 text-[11px] text-neutral-600">
              {renderValue(row.after)}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}
