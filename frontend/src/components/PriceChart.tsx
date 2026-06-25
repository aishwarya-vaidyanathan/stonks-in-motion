import { useMemo, useState } from 'react';
import type { Quote } from '../types';
import { TICKERS, TICKER_COLORS } from '../types';
import { latestBySymbol, pct, seriesBySymbol } from '../lib/series';

interface PriceChartProps {
  quotes: Quote[];
}

type TimeRange = '1m' | '5m' | '15m' | 'all';

// Range → how many trailing points per symbol to plot.
const RANGE_POINTS: Record<TimeRange, number> = {
  '1m': 24,
  '5m': 64,
  '15m': 128,
  all: Infinity,
};

const W = 1100;
const H = 300;
const PAD = 14;

export function PriceChart({ quotes }: PriceChartProps) {
  const [range, setRange] = useState<TimeRange>('all');

  const chart = useMemo(() => {
    if (quotes.length === 0) return null;
    const series = seriesBySymbol(quotes);
    const take = RANGE_POINTS[range];
    let gmin = Infinity;
    let gmax = -Infinity;
    const norm: Record<string, number[]> = {};
    for (const sym of TICKERS) {
      const s = take === Infinity ? series[sym] : series[sym].slice(-take);
      if (s.length === 0) continue;
      const base = s[0] || 1;
      const pc = s.map((v) => (v / base - 1) * 100);
      norm[sym] = pc;
      for (const v of pc) {
        if (v < gmin) gmin = v;
        if (v > gmax) gmax = v;
      }
    }
    if (!isFinite(gmin)) return null;
    const span = gmax - gmin || 1;
    const paths = TICKERS.filter((s) => norm[s]?.length).map((sym) => {
      const pcArr = norm[sym];
      const step = W / (pcArr.length - 1 || 1);
      const d = pcArr
        .map((v, i) => (i ? 'L' : 'M') + (i * step).toFixed(1) + ' ' + (H - PAD - ((v - gmin) / span) * (H - PAD * 2)).toFixed(1))
        .join(' ');
      return { sym, d, color: TICKER_COLORS[sym] };
    });
    const zeroY = (H - PAD - ((0 - gmin) / span) * (H - PAD * 2)).toFixed(1);
    return { paths, zeroY };
  }, [quotes, range]);

  const latest = latestBySymbol(quotes);
  const ranges: TimeRange[] = ['1m', '5m', '15m', 'all'];

  return (
    <>
      <div className="seclabel reveal" style={{ animationDelay: '0.14s' }}>
        <h2>Price History</h2>
      </div>
      <div className="panel reveal" style={{ animationDelay: '0.16s' }}>
        <div className="panel-head">
          <h3>All Symbols · % change</h3>
          <div className="ranges">
            {ranges.map((r) => (
              <button key={r} className={range === r ? 'on' : ''} onClick={() => setRange(r)}>
                {r.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
        <div className="history">
          {chart ? (
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
              <line x1="0" y1={chart.zeroY} x2={W} y2={chart.zeroY} stroke="#1E2740" strokeWidth="1" strokeDasharray="4 4" />
              {chart.paths.map((p) => (
                <path key={p.sym} d={p.d} fill="none" stroke={p.color} strokeWidth="1.8" vectorEffect="non-scaling-stroke" opacity="0.92" />
              ))}
            </svg>
          ) : (
            <div className="empty-flat">
              <span className="empty-msg">Awaiting pipeline · start to stream quotes</span>
            </div>
          )}
        </div>
        {chart && (
          <div className="legend">
            {TICKERS.map((sym) => {
              const q = latest[sym];
              return (
                <span key={sym}>
                  <i style={{ background: TICKER_COLORS[sym] }} />
                  {sym}{' '}
                  {q && <span className={`mono ${q.change_pct >= 0 ? 'up' : 'down'}`}>{pct(q.change_pct)}</span>}
                </span>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
