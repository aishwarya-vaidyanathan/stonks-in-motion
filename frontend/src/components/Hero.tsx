import { useMemo } from 'react';
import type { PipelineStatus, Quote } from '../types';
import { breadth, fmt, fmtUptime, fmtUsd, heroIndex, latestBySymbol, pct, sparkPath } from '../lib/series';

interface HeroProps {
  quotes: Quote[];
  status: PipelineStatus | null;
}

const W = 600;
const H = 150;
const R = 48;
const C = 2 * Math.PI * R;

export function Hero({ quotes, status }: HeroProps) {
  const view = useMemo(() => {
    const latest = latestBySymbol(quotes);
    const ls = Object.values(latest);
    if (ls.length === 0) return null;
    const hero = heroIndex(quotes, latest);
    const b = breadth(latest);
    const spark = sparkPath(hero.series, W, H, 6);
    return {
      hero,
      b,
      spark,
      high: Math.max(...ls.map((q) => q.high)),
      low: Math.min(...ls.map((q) => q.low)),
    };
  }, [quotes]);

  const uptime = fmtUptime(status?.producer.uptime_seconds);

  return (
    <section className="hero reveal" style={{ animationDelay: '0.02s' }}>
      <div className="hero-grid">
        <div className="hero-left">
          <div className="hero-eyebrow">
            <span className="live" /> Market Pulse · {Object.keys(latestBySymbol(quotes)).length || 6} symbols
          </div>

          {view ? (
            <>
              <div className="hero-value mono">{fmt(view.hero.value)}</div>
              <div className="hero-delta">
                <span className={view.hero.cpct >= 0 ? 'up' : 'down'}>
                  {view.hero.cpct >= 0 ? '▲' : '▼'} {fmt(Math.abs(view.hero.change))}
                </span>
                <span className={`chip ${view.hero.cpct >= 0 ? 'up' : 'down'}`}>{pct(view.hero.cpct)}</span>
                <span style={{ color: 'var(--muted)' }}>vs session open</span>
              </div>
              <div className="hero-chart">
                <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none">
                  <defs>
                    <linearGradient id="hg" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={view.hero.cpct >= 0 ? '#34D399' : '#FB7185'} stopOpacity="0.34" />
                      <stop offset="100%" stopColor={view.hero.cpct >= 0 ? '#34D399' : '#FB7185'} stopOpacity="0" />
                    </linearGradient>
                    <linearGradient id="hl" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#22D3EE" />
                      <stop offset="100%" stopColor="#818CF8" />
                    </linearGradient>
                  </defs>
                  <path d={view.spark.area} fill="url(#hg)" />
                  <path d={view.spark.line} fill="none" stroke="url(#hl)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                  <circle
                    cx={view.spark.last[0]}
                    cy={view.spark.last[1]}
                    r="5"
                    fill={view.hero.cpct >= 0 ? 'var(--up)' : 'var(--down)'}
                    style={{ animation: 'glow 2.2s infinite' }}
                  />
                  <circle cx={view.spark.last[0]} cy={view.spark.last[1]} r="11" fill={view.hero.cpct >= 0 ? 'var(--up)' : 'var(--down)'} opacity="0.18" />
                </svg>
              </div>
            </>
          ) : (
            <>
              <div className="hero-value mono">—</div>
              <div className="hero-delta">
                <span style={{ color: 'var(--muted)' }}>No market data</span>
              </div>
              <div className="hero-chart">
                <div className="empty-flat">
                  <span className="empty-msg">Awaiting pipeline · start to stream quotes</span>
                </div>
              </div>
            </>
          )}
        </div>

        <div className="hero-right">
          <div className="breadth-wrap">
            <div className="donut">
              <svg width="116" height="116" viewBox="0 0 116 116">
                <circle cx="58" cy="58" r={R} fill="none" stroke="#1E2740" strokeWidth="12" />
                {view && (
                  <>
                    <circle
                      cx="58"
                      cy="58"
                      r={R}
                      fill="none"
                      stroke="var(--down)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${C - (view.b.adv / view.b.total) * C} ${C}`}
                      strokeDashoffset={-((view.b.adv / view.b.total) * C)}
                    />
                    <circle
                      cx="58"
                      cy="58"
                      r={R}
                      fill="none"
                      stroke="var(--up)"
                      strokeWidth="12"
                      strokeLinecap="round"
                      strokeDasharray={`${(view.b.adv / view.b.total) * C} ${C}`}
                    />
                  </>
                )}
              </svg>
              <div className="donut-label">
                <b>{view ? view.b.advPct + '%' : '—'}</b>
                <small>Advancing</small>
              </div>
            </div>
            <div className="breadth-legend">
              <div>
                <i style={{ background: 'var(--up)' }} /> Advancing <b className="up">{view ? view.b.adv : '—'}</b>
              </div>
              <div>
                <i style={{ background: 'var(--down)' }} /> Declining <b className="down">{view ? view.b.dec : '—'}</b>
              </div>
              <div>
                <i style={{ background: '#1E2740' }} /> Symbols <b>{view ? view.b.total : 6}</b>
              </div>
            </div>
          </div>
          <div className="hero-stats">
            <div className="hstat">
              <small>Day High</small>
              <b>{view ? fmtUsd(view.high) : '—'}</b>
            </div>
            <div className="hstat">
              <small>Day Low</small>
              <b>{view ? fmtUsd(view.low) : '—'}</b>
            </div>
            <div className="hstat">
              <small>Messages</small>
              <b>{quotes.length.toLocaleString()}</b>
            </div>
            <div className="hstat">
              <small>Uptime</small>
              <b>{uptime}</b>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
