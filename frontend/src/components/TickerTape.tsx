import { useMemo } from 'react';
import type { Quote, Ticker } from '../types';
import { TICKER_COLORS, TICKERS } from '../types';

interface TickerTapeProps {
  quotes: Quote[];
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function TickerTape({ quotes }: TickerTapeProps) {
  const items = useMemo(() => {
    return TICKERS.map((ticker) => {
      const tickerQuotes = quotes.filter((q) => q.symbol === ticker);
      const latest = tickerQuotes.length > 0 ? tickerQuotes[tickerQuotes.length - 1] : null;
      return {
        symbol: ticker,
        price: latest ? formatPrice(latest.current) : '--',
        change: latest ? formatPct(latest.change_pct) : '--',
        isPositive: latest ? latest.change_pct >= 0 : null,
        color: TICKER_COLORS[ticker as Ticker],
      };
    });
  }, [quotes]);

  const hasData = quotes.length > 0;

  // ponytail: duplicate content 2x for seamless CSS scroll loop
  const tape = [...items, ...items];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-cyan-900/30 bg-gray-950/95 backdrop-blur-sm">
      <div className="overflow-hidden">
        <div className={`ticker-scroll flex whitespace-nowrap ${!hasData ? 'animate-pulse' : ''}`}>
          {tape.map((item, i) => (
            <div
              key={`${item.symbol}-${i}`}
              className="inline-flex shrink-0 items-center gap-2 px-6 py-2.5"
            >
              <span
                className="text-xs font-bold"
                style={{ color: item.color }}
              >
                {item.symbol}
              </span>
              <span className="font-mono text-xs text-gray-300">
                {item.price}
              </span>
              {item.isPositive !== null ? (
                <span
                  className={`font-mono text-[11px] font-semibold ${
                    item.isPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {item.change}
                </span>
              ) : (
                <span className="font-mono text-[11px] text-gray-600">--</span>
              )}
              {/* Separator dot */}
              <span className="ml-2 text-gray-700">·</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
