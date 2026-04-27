import type { ReactNode } from 'react';

type PanelHeaderProps = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
};

export function PanelHeader({ title, subtitle, actions }: PanelHeaderProps) {
  return (
    <div
      className="flex h-9 shrink-0 items-center justify-between gap-2 px-3"
      style={{
        background: 'var(--color-panel-elev)',
        borderBottom: '1px solid var(--color-border)',
      }}
    >
      <div className="flex min-w-0 items-baseline gap-2">
        <span
          className="truncate text-[12px] font-semibold tracking-tight"
          style={{ color: 'var(--color-text)' }}
        >
          {title}
        </span>
        {subtitle ? (
          <span
            className="truncate text-xs font-normal"
            style={{ color: 'var(--color-text-muted)' }}
          >
            {subtitle}
          </span>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-1">{actions}</div> : null}
    </div>
  );
}
