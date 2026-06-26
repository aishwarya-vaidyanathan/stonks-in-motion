import type { CompanyProfile, Quote } from '../types';
import { TICKERS, TICKER_COLORS } from '../types';
import { fmt, latestBySymbol, pct } from '../lib/series';
import { SymbolLogo } from './SymbolLogo';

interface MarketStripProps {
  quotes: Quote[];
  profiles: Record<string, CompanyProfile>;
}

export function MarketStrip({ quotes, profiles }: MarketStripProps) {
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
                <SymbolLogo symbol={sym} logo={profiles[sym]?.logo} color={TICKER_COLORS[sym]} size={16} />
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
