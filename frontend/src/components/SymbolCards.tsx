import type { CompanyProfile, Quote, SymbolMetrics } from '../types';
import { TICKERS, TICKER_COLORS } from '../types';
import { fmt, fmtCap, fmtNum, fmtUsd, latestBySymbol, pct, seriesBySymbol, sparkPath } from '../lib/series';
import { SymbolLogo } from './SymbolLogo';

interface SymbolCardsProps {
  quotes: Quote[];
  profiles: Record<string, CompanyProfile>;
  metrics: Record<string, SymbolMetrics>;
}

function clampPct(n: number): number {
  return Math.max(0, Math.min(100, n));
}

export function SymbolCards({ quotes, profiles, metrics }: SymbolCardsProps) {
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
          const profile = profiles[sym];
          const m = metrics[sym];

          if (!q) {
            return (
              <div className="card" key={sym}>
                <div className="card-top">
                  <div className="card-sym">
                    <SymbolLogo symbol={sym} logo={profile?.logo} color={color} size={20} />
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
          const rngPos = clampPct(((q.current - q.low) / (q.high - q.low || 1)) * 100);
          const w52 =
            m?.week52High != null && m?.week52Low != null && m.week52High > m.week52Low
              ? clampPct(((q.current - m.week52Low) / (m.week52High - m.week52Low)) * 100)
              : null;

          return (
            <div className="card" key={sym}>
              <div className="card-top">
                <div className="card-sym">
                  <SymbolLogo symbol={sym} logo={profile?.logo} color={color} size={20} />
                  {sym}
                </div>
                <div className={`card-badge ${up ? 'up' : 'down'}`}>{pct(q.change_pct)}</div>
              </div>

              {profile?.name && (
                <div className="card-company">
                  <span className="card-company-name">{profile.name}</span>
                  <span className="card-company-cap">{fmtCap(profile.marketCap)}</span>
                </div>
              )}

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

              {(w52 != null || m?.pe != null || m?.beta != null) && (
                <div className="card-metrics">
                  {w52 != null && (
                    <div className="w52">
                      <div className="w52-label">
                        <span>52W</span>
                        <span>
                          {fmt(m!.week52Low!)} – {fmt(m!.week52High!)}
                        </span>
                      </div>
                      <div className="w52-track">
                        <div className="w52-mark" style={{ left: `${w52}%` }} />
                      </div>
                    </div>
                  )}
                  <div className="mstats">
                    <span>
                      P/E <b>{fmtNum(m?.pe, 1)}</b>
                    </span>
                    <span>
                      β <b>{fmtNum(m?.beta, 2)}</b>
                    </span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}
