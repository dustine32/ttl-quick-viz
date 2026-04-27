import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { Fragment, memo, useCallback, type CSSProperties, type MouseEvent } from 'react';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';
import { useAppDispatch, useAppSelector } from '@/app/hooks';
import { selectCollapsedIds, toggleCollapsed } from '@/features/graph-tree/treeSlice';

type MindMapNodeData = {
  label: string;
  width?: number;
  subtitle?: string | null;
  hiddenChildCount?: number;
  isRoot?: boolean;
  subtreeColor?: string;
  hasChildren?: boolean;
};
type MindMapNodeType = Node<MindMapNodeData, 'mindmap'>;

const HANDLE_OFFSETS = [50] as const;
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

const ROOT_BG = '#1F2937';
const ROOT_TEXT = '#F8FAFC';

export const MindMapNode = memo(({ id, data, selected }: NodeProps<MindMapNodeType>) => {
  const dispatch = useAppDispatch();
  const collapsedIds = useAppSelector(selectCollapsedIds);
  const isCollapsed = collapsedIds.has(id);
  const isRoot = data.isRoot === true;
  const subtree = data.subtreeColor ?? '#94a3b8';
  const width = data.width ?? 180;
  const hidden = data.hiddenChildCount ?? 0;
  const showChevron = isCollapsed || data.hasChildren === true || hidden > 0;

  const onChevron = useCallback(
    (e: MouseEvent) => {
      e.stopPropagation();
      dispatch(toggleCollapsed(id));
    },
    [dispatch, id],
  );

  const containerStyle: CSSProperties = isRoot
    ? {
      width,
      background: ROOT_BG,
      color: ROOT_TEXT,
      boxShadow: selected
        ? `0 0 0 3px ${subtree}, 0 14px 28px -10px rgba(0,0,0,0.55)`
        : '0 10px 24px -10px rgba(0,0,0,0.5), 0 4px 10px -4px rgba(0,0,0,0.3)',
      borderRadius: 999,
      paddingInline: 18,
      paddingBlock: 12,
    }
    : {
      width,
      background: '#FFFFFF',
      color: '#0F172A',
      boxShadow: selected
        ? `0 0 0 2px ${subtree}, 0 10px 22px -10px rgba(0,0,0,0.45)`
        : '0 6px 14px -8px rgba(0,0,0,0.35), 0 2px 6px -2px rgba(0,0,0,0.25)',
      borderRadius: 999,
      borderLeft: `4px solid ${subtree}`,
      paddingInline: 14,
      paddingBlock: 8,
    };

  return (
    <div
      style={containerStyle}
      className="group relative flex items-center gap-2"
      title={data.label}
    >
      {!isRoot ? (
        <span
          style={{ backgroundColor: subtree }}
          className="h-2 w-2 shrink-0 rounded-full"
        />
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        <span
          className={`tracking-tight wrap-break-word ${isRoot
            ? 'text-sm font-bold leading-snug'
            : 'text-xs font-semibold leading-snug'
            }`}
        >
          {data.label}
        </span>
        {data.subtitle ? (
          <span
            className={`truncate text-[10.5px] font-medium ${isRoot ? 'text-slate-300' : 'text-slate-400'
              }`}
          >
            {data.subtitle}
          </span>
        ) : null}
      </div>
      {showChevron ? (
        <button
          type="button"
          onClick={onChevron}
          onMouseDown={(e) => e.stopPropagation()}
          aria-label={isCollapsed ? 'Expand subtree' : 'Collapse subtree'}
          style={{
            background: isRoot ? 'rgba(255,255,255,0.10)' : `${subtree}1A`,
            color: isRoot ? ROOT_TEXT : subtree,
          }}
          className="flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10.5px] font-semibold transition-opacity hover:brightness-110"
        >
          {isCollapsed ? <LuChevronRight size={12} /> : <LuChevronLeft size={12} />}
          {isCollapsed && hidden > 0 ? <span>+{hidden}</span> : null}
        </button>
      ) : null}
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

MindMapNode.displayName = 'MindMapNode';
