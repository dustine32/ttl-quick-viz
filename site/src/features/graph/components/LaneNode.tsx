import { memo, type CSSProperties } from 'react';
import type { NodeProps, Node } from '@xyflow/react';

export type LaneNodeData = {
  label: string;
  count: number;
  width: number;
  height: number;
  isOther?: boolean;
  level: 0 | 1;
};

export type LaneNodeType = Node<LaneNodeData, 'lane'>;

export const LaneNode = memo(({ data }: NodeProps<LaneNodeType>) => {
  const isTop = data.level === 0;
  const headerH = isTop ? 36 : 24;
  const containerStyle: CSSProperties = {
    width: data.width,
    height: data.height,
    background: data.isOther
      ? 'rgba(148, 163, 184, 0.05)'
      : isTop
        ? 'rgba(99, 102, 241, 0.04)'
        : 'rgba(14, 165, 233, 0.05)',
    border: `${isTop ? '1px dashed' : '1px dashed'} ${
      data.isOther
        ? 'rgba(148, 163, 184, 0.5)'
        : isTop
          ? 'rgba(99, 102, 241, 0.4)'
          : 'rgba(14, 165, 233, 0.45)'
    }`,
    borderRadius: isTop ? 12 : 10,
    pointerEvents: 'none',
  };

  const headerBg = data.isOther
    ? 'rgba(148, 163, 184, 0.10)'
    : isTop
      ? 'rgba(99, 102, 241, 0.08)'
      : 'rgba(14, 165, 233, 0.10)';

  const headerStyle: CSSProperties = {
    height: headerH,
    padding: `0 ${isTop ? 12 : 10}px`,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    borderBottom: `1px solid ${
      data.isOther
        ? 'rgba(148, 163, 184, 0.35)'
        : isTop
          ? 'rgba(99, 102, 241, 0.3)'
          : 'rgba(14, 165, 233, 0.3)'
    }`,
    background: headerBg,
    borderTopLeftRadius: isTop ? 12 : 10,
    borderTopRightRadius: isTop ? 12 : 10,
  };

  return (
    <div style={containerStyle}>
      <div style={headerStyle}>
        <span
          className={`truncate font-semibold uppercase tracking-wider ${
            isTop ? 'text-[11.5px]' : 'text-[10.5px]'
          }`}
          style={{ color: 'var(--color-text-muted)' }}
        >
          {data.label}
        </span>
        <span
          className="ml-auto rounded px-1.5 py-[1px] text-[10px] font-semibold tabular-nums"
          style={{
            color: 'var(--color-text-muted)',
            background: 'rgba(148, 163, 184, 0.18)',
          }}
        >
          {data.count}
        </span>
      </div>
    </div>
  );
});

LaneNode.displayName = 'LaneNode';
