import type { Quote } from '../types';
import { TICKERS, TICKER_COLORS } from '../types';
import { fmt, fmtUsd, latestBySymbol, pct, seriesBySymbol, sparkPath } from '../lib/series';

interface SymbolCardsProps {
  quotes: Quote[];
}

export function SymbolCards({ quotes }: SymbolCardsProps) {
  const latest = latestBySymbol(quotes);
  const series = seriesBySymbol(quotes);

  return (
    <>
      <div className="seclabel reveal" style={{ animationDelay: '0.10s' }}>
        <h2>Symbols</h2>
        <span className="meta">intraday</span>
      </div>
      <div className="cards reveal" style={{ animationDelay: '0.12s' }}>
        {TICKERS.map((sym) => {
          const color = TICKER_COLORS[sym];
          const q = latest[sym];

          if (!q) {
            return (
              <div className="card" key={sym}>
                <div className="card-top">
                  <div className="card-sym">
                    <i style={{ background: color }} />
                    {sym}
                  </div>
                </div>
                <div className="card-spark skel" style={{ height: 56, margin: '12px 0 10px' }} />
                <div className="skel" style={{ height: 22, width: '60%' }} />
              </div>
            );
          }

          const up = q.change_pct >= 0;
          const sp = sparkPath(series[sym], 300, 56, 4);
          const rngPos = ((q.current - q.low) / (q.high - q.low || 1)) * 100;

          return (
            <div className="card" key={sym}>
              <div className="card-top">
                <div className="card-sym">
                  <i style={{ background: color }} />
                  {sym}
                </div>
                <div className={`card-badge ${up ? 'up' : 'down'} ${up ? 'up' : 'down'}`}>{pct(q.change_pct)}</div>
              </div>
              <div className="card-spark">
                <svg viewBox="0 0 300 56" preserveAspectRatio="none">
                  <defs>
                    <linearGradient id={`g${sym}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={color} stopOpacity="0.25" />
                      <stop offset="100%" stopColor={color} stopOpacity="0" />
                    </linearGradient>
                  </defs>
                  <path d={sp.area} fill={`url(#g${sym})`} />
                  <path d={sp.line} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" />
                  <circle cx={sp.last[0]} cy={sp.last[1]} r="3" fill={color} />
                </svg>
              </div>
              <div className="card-price">{fmtUsd(q.current)}</div>
              <div className={`card-sub ${up ? 'up' : 'down'}`}>
                {up ? '+' : ''}
                {fmt(q.change)} today
              </div>
              <div className="range">
                <div className="range-track">
                  <div className="range-fill" style={{ left: 0, width: `${rngPos}%` }} />
                  <div className="range-mark" style={{ left: `${rngPos}%` }} />
                </div>
                <div className="range-lbl">
                  <span>L {fmt(q.low)}</span>
                  <span>H {fmt(q.high)}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
