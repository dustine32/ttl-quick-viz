import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Fragment, memo, type CSSProperties } from 'react';

type PrettyNodeData = {
  label: string;
  color?: string;
  width?: number;
  subtitle?: string | null;
};
type PrettyNodeType = Node<PrettyNodeData, 'pretty'>;

const HANDLE_OFFSETS = [25, 50, 75] as const;
const SIDES = [
  { position: Position.Top, key: 'top' as const },
  { position: Position.Right, key: 'right' as const },
  { position: Position.Bottom, key: 'bottom' as const },
  { position: Position.Left, key: 'left' as const },
];

const HANDLE_STYLE_BASE: CSSProperties = {
  width: 1,
  height: 1,
  background: 'transparent',
  border: 'none',
  opacity: 0,
};

export const PrettyNode = memo(({ data, selected }: NodeProps<PrettyNodeType>) => {
  const accent = data.color ?? '#94a3b8';
  const width = data.width ?? 180;

  const boxShadow = selected
    ? `0 0 0 2px ${accent}, 0 18px 36px -12px rgba(0, 0, 0, 0.55), 0 6px 16px -6px rgba(0, 0, 0, 0.45)`
    : '0 4px 12px -4px rgba(0, 0, 0, 0.4), 0 12px 28px -16px rgba(0, 0, 0, 0.55)';

  return (
    <div
      style={{ width, boxShadow }}
      className="group relative overflow-hidden rounded-xl border border-slate-200/40 bg-white transition-shadow duration-150 hover:shadow-2xl"
      title={data.label}
    >
      <div
        style={{ background: `linear-gradient(90deg, ${accent} 0%, ${accent}99 100%)` }}
        className="h-1.5 w-full"
      />
      <div className="flex items-center gap-2 px-3 py-2">
        <span
          style={{ backgroundColor: accent, boxShadow: `0 0 0 3px ${accent}22` }}
          className="flex h-2.5 w-2.5 shrink-0 rounded-full"
        />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="truncate text-xs font-semibold tracking-tight text-slate-800">
            {data.label}
          </span>
          {data.subtitle ? (
            <span className="truncate text-[10.5px] font-medium text-slate-400">
              {data.subtitle}
            </span>
          ) : null}
        </div>
      </div>
      {SIDES.map(({ position, key }) => {
        const isHorizontal = position === Position.Top || position === Position.Bottom;
        return HANDLE_OFFSETS.map((offset, i) => {
          const offsetStyle: CSSProperties = isHorizontal
            ? { left: `${offset}%` }
            : { top: `${offset}%` };
          const handleStyle: CSSProperties = { ...HANDLE_STYLE_BASE, ...offsetStyle };
          return (
            <Fragment key={`${key}-${i}`}>
              <Handle
                id={`s-${key}-${i}`}
                type="source"
                position={position}
                style={handleStyle}
                isConnectable={false}
              />
              <Handle
                id={`t-${key}-${i}`}
                type="target"
                position={position}
                style={handleStyle}
                isConnectable={false}
              />
            </Fragment>
          );
        });
      })}
    </div>
  );
});

PrettyNode.displayName = 'PrettyNode';
