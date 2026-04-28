import { ActionIcon, CopyButton, Tooltip } from '@mantine/core';
import type { ReactNode } from 'react';
import { LuArrowRight, LuCheck, LuCircleDot, LuCopy } from 'react-icons/lu';
import type { DiffStatus } from '@/features/diff';

export function TypeChip({ kind }: { kind: 'node' | 'edge' }) {
  const config =
    kind === 'node'
      ? {
          icon: <LuCircleDot size={10} />,
          cls: 'border-sky-200 bg-sky-50 text-sky-700',
          label: 'Node',
        }
      : {
          icon: <LuArrowRight size={10} />,
          cls: 'border-violet-200 bg-violet-50 text-violet-700',
          label: 'Edge',
        };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[1px] text-[10px] font-semibold tracking-wide ${config.cls}`}
    >
      {config.icon}
      {config.label}
    </span>
  );
}

const DIFF_STYLES: Record<DiffStatus, string> = {
  added: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  removed: 'border-red-200 bg-red-50 text-red-700',
  changed: 'border-amber-200 bg-amber-50 text-amber-800',
  unchanged: 'border-slate-200 bg-slate-50 text-slate-600',
};

export function DiffStatusPill({ status }: { status: DiffStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-[1px] text-[10px] font-semibold uppercase tracking-wide ${DIFF_STYLES[status]}`}
    >
      {status}
    </span>
  );
}

const TYPE_PALETTE = [
  'border-sky-200 bg-sky-50 text-sky-700',
  'border-violet-200 bg-violet-50 text-violet-700',
  'border-emerald-200 bg-emerald-50 text-emerald-700',
  'border-amber-200 bg-amber-50 text-amber-800',
  'border-rose-200 bg-rose-50 text-rose-700',
  'border-cyan-200 bg-cyan-50 text-cyan-700',
  'border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700',
  'border-lime-200 bg-lime-50 text-lime-700',
];

// Stable color from the type string so the same RDF type always lands in the
// same palette slot across rows / panel re-renders.
function paletteFor(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return TYPE_PALETTE[Math.abs(h) % TYPE_PALETTE.length];
}

// Strip namespace prefix so chips read clean (e.g. "obo:GO_0008150" → "GO_0008150",
// "http://.../BiologicalProcess" → "BiologicalProcess").
export function shortType(t: string): string {
  const slash = t.lastIndexOf('/');
  const hash = t.lastIndexOf('#');
  const colon = t.lastIndexOf(':');
  const cut = Math.max(slash, hash, colon);
  return cut >= 0 ? t.slice(cut + 1) : t;
}

const TYPE_KEYS = new Set(['rdf:type', 'type', 'types']);

export function isTypeKey(k: string): boolean {
  return TYPE_KEYS.has(k);
}

// Coerce an attrs value into a list of type strings. Handles native arrays,
// JSON-stringified arrays, and comma-separated strings — all of which appear
// in TTL → graph translations depending on the upstream emitter.
export function extractTypeList(value: unknown): string[] {
  if (value == null) return [];
  if (Array.isArray(value)) return value.map((v) => String(v)).filter(Boolean);
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v)).filter(Boolean);
      } catch {
        /* fall through */
      }
    }
    if (trimmed.includes(',')) {
      return trimmed
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return trimmed ? [trimmed] : [];
  }
  return [String(value)];
}

export function extractTypesFromAttrs(
  attrs: Record<string, unknown> | undefined,
): string[] {
  if (!attrs) return [];
  for (const k of TYPE_KEYS) {
    if (k in attrs) return extractTypeList(attrs[k]);
  }
  return [];
}

export function TypeBadgeList({
  types,
  size = 'sm',
}: {
  types: string[];
  size?: 'sm' | 'xs';
}) {
  if (types.length === 0) return null;
  const cls =
    size === 'sm'
      ? 'rounded-full border px-2 py-[1px] text-[10px] font-medium'
      : 'rounded-full border px-1.5 py-[0.5px] text-[9.5px] font-medium';
  return (
    <div className="flex flex-wrap items-center gap-1">
      {types.map((t) => (
        <Tooltip key={t} label={t} withArrow openDelay={400} disabled={shortType(t) === t}>
          <span className={`${cls} ${paletteFor(t)}`}>{shortType(t)}</span>
        </Tooltip>
      ))}
    </div>
  );
}

export function SectionHeader({
  label,
  count,
  icon,
}: {
  label: string;
  count?: number | string;
  icon?: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1.5 pb-1.5">
      {icon && (
        <span className="flex items-center text-slate-400" aria-hidden>
          {icon}
        </span>
      )}
      <span className="text-[10px] font-semibold uppercase tracking-[0.5px] text-slate-500">
        {label}
      </span>
      {count != null && (
        <span className="text-[10px] tabular-nums text-slate-400">{count}</span>
      )}
      <span className="ml-1 h-px flex-1 bg-slate-200/70" />
    </div>
  );
}

export function KvRow({
  label,
  value,
  children,
  copyValue,
  mono,
}: {
  label: string;
  value?: string;
  children?: ReactNode;
  copyValue?: string;
  mono?: boolean;
}) {
  const cv = copyValue ?? value;
  return (
    <div className="group flex items-start gap-2 rounded px-1.5 py-1 transition-colors hover:bg-slate-50">
      <span className="w-16 shrink-0 pt-[1px] text-[10px] font-medium uppercase tracking-[0.3px] text-slate-500">
        {label}
      </span>
      <div
        className={`min-w-0 flex-1 break-all text-[12px] leading-snug text-slate-800 ${
          mono ? 'font-mono' : ''
        }`}
      >
        {children ?? value}
      </div>
      {cv != null && (
        <CopyButton value={cv}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow openDelay={300}>
              <ActionIcon
                size="xs"
                variant="subtle"
                color="gray"
                onClick={copy}
                className="opacity-0 transition-opacity group-hover:opacity-100"
              >
                {copied ? <LuCheck size={11} /> : <LuCopy size={11} />}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      )}
    </div>
  );
}

// AttrRow renders an attribute key/value pair where the key is a real
// identifier (e.g. `rdf:type`, `obo:RO_0002233`). Layout is stacked: qname on
// top in mono, value below — long values get the full row width, and rdf:type
// values render as colored chips.
export function AttrRow({ k, value }: { k: string; value: unknown }) {
  const typed = isTypeKey(k);
  const types = typed ? extractTypeList(value) : [];
  const stringValue = typed ? '' : formatAttrValue(value);
  const accent = typed ? 'border-violet-300' : 'border-slate-200';
  const hoverAccent = typed ? '' : 'group-hover:border-sky-400';

  return (
    <div
      className={`group rounded-md border-l-2 ${accent} ${hoverAccent} bg-slate-50/50 px-2 py-1.5 transition-colors hover:bg-slate-100/60`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <code className="break-all font-mono text-[10.5px] leading-snug text-slate-600">
          {k}
        </code>
        {!typed && stringValue && (
          <CopyButton value={stringValue}>
            {({ copied, copy }) => (
              <Tooltip label={copied ? 'Copied' : 'Copy'} withArrow openDelay={300}>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="gray"
                  onClick={copy}
                  className="opacity-0 transition-opacity group-hover:opacity-100"
                >
                  {copied ? <LuCheck size={11} /> : <LuCopy size={11} />}
                </ActionIcon>
              </Tooltip>
            )}
          </CopyButton>
        )}
      </div>
      {typed ? (
        <TypeBadgeList types={types} />
      ) : (
        <div className="break-all text-[12px] leading-snug text-slate-800">
          {stringValue}
        </div>
      )}
    </div>
  );
}

function formatAttrValue(v: unknown): string {
  if (v == null) return '';
  if (Array.isArray(v)) return v.map((x) => String(x)).join(', ');
  return String(v);
}

export function InspectorHeader({
  kind,
  diffStatus,
  primary,
  secondary,
  types,
}: {
  kind: 'node' | 'edge';
  diffStatus?: DiffStatus | undefined;
  primary: ReactNode;
  secondary?: ReactNode;
  types?: string[];
}) {
  return (
    <div
      className="flex flex-col gap-2 pb-3"
      style={{ borderBottom: '1px solid var(--color-border)' }}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <TypeChip kind={kind} />
        {diffStatus && <DiffStatusPill status={diffStatus} />}
      </div>
      <div className="flex flex-col gap-0.5">
        <h3 className="break-all text-[14px] font-semibold leading-tight text-slate-900">
          {primary}
        </h3>
        {secondary && (
          <span className="break-all font-mono text-[10.5px] leading-snug text-slate-500">
            {secondary}
          </span>
        )}
      </div>
      {types && types.length > 0 && <TypeBadgeList types={types} size="xs" />}
    </div>
  );
}
