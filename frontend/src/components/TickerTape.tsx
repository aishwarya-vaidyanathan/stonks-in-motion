import type { Quote } from '../types';
import { TICKERS, TICKER_COLORS } from '../types';
import { fmt, latestBySymbol, pct } from '../lib/series';

interface TickerTapeProps {
  quotes: Quote[];
}

export function TickerTape({ quotes }: TickerTapeProps) {
  const latest = latestBySymbol(quotes);

  const one = TICKERS.map((sym) => {
    const q = latest[sym];
    const up = q ? q.change_pct >= 0 : true;
    return (
      <span className="tape-item" key={sym}>
        <b style={{ color: TICKER_COLORS[sym] }}>{sym}</b>
        <span className="p">{q ? fmt(q.current) : '--.--'}</span>
        {q ? (
          <span className={`d ${up ? 'up' : 'down'}`}>
            {up ? '▲' : '▼'}
            {pct(q.change_pct)}
          </span>
        ) : (
          <span className="d" style={{ color: 'var(--muted)' }}>
            --
          </span>
        )}
      </span>
    );
  });

  // ponytail: render the row 4× so the -50% scroll loops seamlessly
  return (
    <div className="tape">
      <div className="tape-track">
        {one}
        {one}
        {one}
        {one}
      </div>
    </div>
  );
}
