type CountPillProps = {
  count: number | string;
  dim?: boolean;
};

export function CountPill({ count, dim }: CountPillProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-1.5 py-[1px] text-[10px] font-medium tabular-nums ${
        dim
          ? 'bg-slate-100 text-slate-400'
          : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
      }`}
    >
      {count}
    </span>
  );
}
