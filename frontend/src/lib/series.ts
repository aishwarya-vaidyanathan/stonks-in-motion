import type { Quote } from '../types';
import { TICKERS } from '../types';

/** Format a number with 2 decimals and grouped thousands. */
export const fmt = (n: number): string =>
  n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Format as USD. */
export const fmtUsd = (n: number): string => '$' + fmt(n);

/** Signed percentage string, e.g. "+1.24%". */
export const pct = (n: number): string => (n >= 0 ? '+' : '') + n.toFixed(2) + '%';

/** Market cap from millions USD → "$2.94T" / "$812.3B" / "$540M". */
export function fmtCap(millions: number | null | undefined): string {
  if (millions == null || !isFinite(millions)) return '—';
  if (millions >= 1_000_000) return '$' + (millions / 1_000_000).toFixed(2) + 'T';
  if (millions >= 1_000) return '$' + (millions / 1_000).toFixed(1) + 'B';
  return '$' + millions.toFixed(0) + 'M';
}

/** Compact number, e.g. 1234.5 → "1.23k". null → "—". */
export const fmtNum = (n: number | null | undefined, digits = 2): string =>
  n == null || !isFinite(n) ? '—' : n.toFixed(digits);

/** Human uptime: 45s / 12m / 1h03m. */
export function fmtUptime(seconds: number | null | undefined): string {
  if (!seconds || seconds < 0) return '0s';
  if (seconds < 60) return Math.round(seconds) + 's';
  if (seconds < 3600) return Math.round(seconds / 60) + 'm';
  return Math.floor(seconds / 3600) + 'h' + String(Math.round((seconds % 3600) / 60)).padStart(2, '0') + 'm';
}

export interface SparkResult {
  line: string;
  area: string;
  last: [number, number];
}

/** Build an SVG line + area path from a value series scaled to w×h. */
export function sparkPath(vals: number[], w: number, h: number, pad = 2): SparkResult {
  if (vals.length === 0) return { line: '', area: '', last: [0, h] };
  const v = vals.length === 1 ? [vals[0], vals[0]] : vals;
  const min = Math.min(...v);
  const max = Math.max(...v);
  const span = max - min || 1;
  const step = w / (v.length - 1);
  const pts = v.map(
    (val, i) =>
      [+(i * step).toFixed(2), +(h - pad - ((val - min) / span) * (h - pad * 2)).toFixed(2)] as [
        number,
        number,
      ],
  );
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0] + ' ' + p[1]).join(' ');
  const area = line + ` L${w} ${h} L0 ${h} Z`;
  return { line, area, last: pts[pts.length - 1] };
}

/** Chronological `current` price series per symbol. */
export function seriesBySymbol(quotes: Quote[]): Record<string, number[]> {
  const out: Record<string, number[]> = {};
  for (const t of TICKERS) out[t] = [];
  for (const q of quotes) {
    if (out[q.symbol]) out[q.symbol].push(q.current);
  }
  return out;
}

/** Latest quote per symbol (quotes are chronological, last wins). */
export function latestBySymbol(quotes: Quote[]): Record<string, Quote> {
  const out: Record<string, Quote> = {};
  for (const q of quotes) out[q.symbol] = q;
  return out;
}

export interface HeroData {
  series: number[];
  value: number;
  change: number;
  cpct: number;
}

/**
 * Market-pulse index. Curve = equal-weight portfolio normalized to each
 * symbol's first-seen price, walked over the quote timeline. Headline value =
 * base scaled by the average daily change_pct across symbols (so it agrees
 * with the cards and breadth).
 */
export function heroIndex(quotes: Quote[], latest: Record<string, Quote>, base = 1000): HeroData {
  const first: Record<string, number> = {};
  const last: Record<string, number> = {};
  const series: number[] = [];
  for (const q of quotes) {
    if (first[q.symbol] === undefined) first[q.symbol] = q.current;
    last[q.symbol] = q.current;
    const syms = Object.keys(last);
    let sum = 0;
    for (const s of syms) sum += last[s] / first[s] - 1;
    series.push(base * (1 + sum / syms.length));
  }
  const ls = Object.values(latest);
  const avg = ls.length ? ls.reduce((a, q) => a + q.change_pct, 0) / ls.length : 0;
  const value = base * (1 + avg / 100);
  return { series, value, change: value - base, cpct: avg };
}

export interface Breadth {
  adv: number;
  dec: number;
  total: number;
  advPct: number;
}

/** Advancing vs declining count from latest quote per symbol. */
export function breadth(latest: Record<string, Quote>): Breadth {
  let adv = 0;
  let dec = 0;
  for (const q of Object.values(latest)) {
    if (q.change_pct >= 0) adv++;
    else dec++;
  }
  const total = adv + dec;
  return { adv, dec, total, advPct: total ? Math.round((adv / total) * 100) : 0 };
}
