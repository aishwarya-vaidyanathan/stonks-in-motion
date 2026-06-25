import type { Quote } from '../types';
import { TICKERS, TICKER_COLORS } from '../types';
import { fmt, latestBySymbol, pct } from '../lib/series';

interface MarketStripProps {
  quotes: Quote[];
}

export function MarketStrip({ quotes }: MarketStripProps) {
  const latest = latestBySymbol(quotes);
  const time = quotes.length
    ? new Date(quotes[quotes.length - 1].receivedAt).toLocaleTimeString('en-US', { hour12: false })
    : '';

  return (
    <>
      <div className="seclabel reveal" style={{ animationDelay: '0.06s' }}>
        <h2>Watchlist</h2>
        <span className="meta">{time}</span>
      </div>
      <div className="strip reveal" style={{ animationDelay: '0.08s' }}>
        {TICKERS.map((sym) => {
          const q = latest[sym];
          const up = q ? q.change_pct >= 0 : true;
          return (
            <div className="strip-item" key={sym}>
              <div className="strip-sym">
                <i style={{ background: TICKER_COLORS[sym] }} />
                {sym}
              </div>
              <div className="strip-price" style={q ? undefined : { color: 'var(--muted)' }}>
                {q ? fmt(q.current) : '--.--'}
              </div>
              <div
                className={`strip-delta ${q ? (up ? 'up' : 'down') : ''}`}
                style={q ? undefined : { color: 'var(--muted)' }}
              >
                {q ? `${up ? '▲' : '▼'} ${pct(q.change_pct)}` : '--'}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
