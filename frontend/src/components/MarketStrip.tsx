import { useMemo } from 'react';
import type { Quote, Ticker } from '../types';
import { TICKER_COLORS, TICKERS } from '../types';

interface MarketStripProps {
  quotes: Quote[];
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatChange(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}`;
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function MarketStrip({ quotes }: MarketStripProps) {
  const items = useMemo(() => {
    return TICKERS.map((ticker) => {
      const tickerQuotes = quotes.filter((q) => q.symbol === ticker);
      const latest = tickerQuotes.length > 0 ? tickerQuotes[tickerQuotes.length - 1] : null;
      return {
        symbol: ticker,
        price: latest?.current,
        change: latest?.change,
        changePct: latest?.change_pct,
        color: TICKER_COLORS[ticker as Ticker],
      };
    });
  }, [quotes]);

  return (
    <div className="border-b border-gray-800 bg-gray-950">
      <div className="mx-auto flex max-w-7xl items-center gap-0 overflow-x-auto px-2 sm:px-4">
        {items.map((item) => {
          const hasData = item.price != null;
          const isPositive = (item.changePct ?? 0) >= 0;
          return (
            <div
              key={item.symbol}
              className="flex shrink-0 items-center gap-2 border-r border-gray-800/50 px-3 py-1.5 last:border-r-0 sm:px-4"
            >
              <span className="text-[11px] font-bold text-gray-300">{item.symbol}</span>
              <span className="font-mono text-[11px] text-gray-100">
                {hasData ? formatPrice(item.price!) : '--'}
              </span>
              {hasData ? (
                <span
                  className={`font-mono text-[10px] font-semibold ${
                    isPositive ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {formatChange(item.change!)} {formatPct(item.changePct!)}
                </span>
              ) : (
                <span className="font-mono text-[10px] text-gray-600">-- --</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
