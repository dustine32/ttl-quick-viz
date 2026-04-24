import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Fragment, memo, type CSSProperties } from 'react';

type PrettyNodeData = { label: string };
type PrettyNodeType = Node<PrettyNodeData, 'pretty'>;

const HANDLE_OFFSETS = [25, 50, 75] as const;
const SIDES = [
  { position: Position.Top, key: 'top' as const },
  { position: Position.Right, key: 'right' as const },
  { position: Position.Bottom, key: 'bottom' as const },
  { position: Position.Left, key: 'left' as const },
];

const HANDLE_STYLE_BASE: CSSProperties = {
  width: 8,
  height: 8,
  background: '#ffffff',
  border: '2px solid #94a3b8',
  opacity: 0.85,
};

export const PrettyNode = memo(({ data, selected }: NodeProps<PrettyNodeType>) => {
  const boxShadow = selected
    ? '0 0 0 3px #60a5fa, 0 14px 28px -12px rgba(15, 23, 42, 0.35)'
    : '0 10px 20px -10px rgba(15, 23, 42, 0.25), inset 0 0 0 1px rgba(255, 255, 255, 0.6)';

  return (
    <div
      style={{
        background: 'linear-gradient(180deg, #ffffff 0%, #f1f5f9 100%)',
        boxShadow,
        minWidth: 140,
      }}
      className="relative rounded-xl border border-slate-300/80 px-4 py-2.5 text-sm font-medium tracking-tight text-slate-800"
    >
      <span className="pointer-events-none select-none whitespace-nowrap">
        {data.label}
      </span>
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
