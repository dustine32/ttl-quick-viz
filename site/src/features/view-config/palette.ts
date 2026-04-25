export const DEFAULT_NODE_COLOR = '#2563eb';
export const UNTYPED_NODE_COLOR = '#64748b';

export const TYPE_PALETTE: string[] = [
  '#2563eb',
  '#16a34a',
  '#dc2626',
  '#9333ea',
  '#ea580c',
  '#0891b2',
  '#ca8a04',
  '#db2777',
  '#059669',
  '#7c3aed',
  '#e11d48',
  '#0284c7',
  '#65a30d',
  '#c026d3',
  '#b45309',
  '#475569',
];

export function colorForType(type: string | null | undefined): string {
  if (!type) return UNTYPED_NODE_COLOR;
  let h = 0;
  for (let i = 0; i < type.length; i++) {
    h = (h * 31 + type.charCodeAt(i)) | 0;
  }
  return TYPE_PALETTE[Math.abs(h) % TYPE_PALETTE.length];
}
