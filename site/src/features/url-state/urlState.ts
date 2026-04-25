import type { RootState } from '@/app/store';
import type { LabelMode } from '@/features/view-config/viewConfigSlice';
import type { GraphRenderer } from '@/features/graph';

export type UrlState = {
  v: 1;
  g?: string;
  r?: GraphRenderer;
  lm?: LabelMode;
  la?: string;
  lc?: string;
  hp?: string[];
  ht?: string[];
  fid?: string;
  fd?: number;
  rv?: string[];
  sbd?: boolean;
};

function csv(list: string[]): string {
  return list.map((v) => encodeURIComponent(v)).join(',');
}

function parseCsv(raw: string): string[] {
  if (!raw) return [];
  return raw.split(',').filter(Boolean).map((v) => decodeURIComponent(v));
}

export function serialize(s: UrlState): string {
  const params = new URLSearchParams();
  params.set('v', '1');
  if (s.g) params.set('g', s.g);
  if (s.r) params.set('r', s.r);
  if (s.lm) params.set('lm', s.lm);
  if (s.la) params.set('la', s.la);
  if (s.lc) params.set('lc', s.lc);
  if (s.hp && s.hp.length) params.set('hp', csv(s.hp));
  if (s.ht && s.ht.length) params.set('ht', csv(s.ht));
  if (s.fid) params.set('fid', s.fid);
  if (s.fd !== undefined) params.set('fd', String(s.fd));
  if (s.rv && s.rv.length) params.set('rv', csv(s.rv));
  if (s.sbd) params.set('sbd', '1');
  return params.toString();
}

export function parse(hash: string): UrlState | null {
  const cleaned = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!cleaned) return null;
  const params = new URLSearchParams(cleaned);
  if (params.get('v') !== '1') return null;

  const out: UrlState = { v: 1 };
  const g = params.get('g');
  if (g) out.g = g;
  const r = params.get('r');
  if (
    r === 'xyflow' ||
    r === 'cytoscape' ||
    r === 'force' ||
    r === 'force3d' ||
    r === 'sigma' ||
    r === 'graphin'
  ) {
    out.r = r;
  }
  const lm = params.get('lm');
  if (lm === 'prefixed' || lm === 'full' || lm === 'label') out.lm = lm;
  const la = params.get('la');
  if (la) out.la = la;
  const lc = params.get('lc');
  if (lc) out.lc = lc;
  const hp = params.get('hp');
  if (hp) out.hp = parseCsv(hp);
  const ht = params.get('ht');
  if (ht) out.ht = parseCsv(ht);
  const fid = params.get('fid');
  if (fid) out.fid = fid;
  const fd = params.get('fd');
  if (fd !== null) {
    const n = Number(fd);
    if (Number.isFinite(n)) out.fd = n;
  }
  const rv = params.get('rv');
  if (rv) out.rv = parseCsv(rv);
  if (params.get('sbd') === '1') out.sbd = true;
  return out;
}

export function fromStore(state: RootState): UrlState {
  const { graph, viewConfig } = state;
  return {
    v: 1,
    g: graph.selectedGraphId || undefined,
    r: graph.renderer,
    lm: viewConfig.labelMode,
    la: viewConfig.layoutAlgoXyflow,
    lc: viewConfig.layoutAlgoCytoscape,
    hp: viewConfig.hiddenPredicates,
    ht: viewConfig.hiddenTypes,
    fid: viewConfig.focusNodeId ?? undefined,
    fd: viewConfig.focusDepth,
    rv: viewConfig.revealedNodeIds,
    sbd: viewConfig.sizeByDegree,
  };
}
