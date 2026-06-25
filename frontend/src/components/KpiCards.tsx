import { SparkLineChart } from '@tremor/react';
import type { Quote, Ticker } from '../types';
import { TICKER_COLORS, TICKERS } from '../types';
import { useMemo } from 'react';

interface KpiCardsProps {
  quotes: Quote[];
}

interface TickerData {
  latest: Quote | null;
  sparkline: { time: string; price: number }[];
}

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function KpiCards({ quotes }: KpiCardsProps) {
  const tickerData = useMemo(() => {
    const map = new Map<string, TickerData>();
    for (const ticker of TICKERS) {
      const tickerQuotes = quotes.filter((q) => q.symbol === ticker);
      const latest = tickerQuotes.length > 0 ? tickerQuotes[tickerQuotes.length - 1] : null;
      const sparkline = tickerQuotes.slice(-30).map((q) => ({
        time: q.receivedAt,
        price: q.current,
      }));
      map.set(ticker, { latest, sparkline });
    }
    return map;
  }, [quotes]);

  return (
    <div className="grid grid-cols-1 gap-px bg-gray-800 sm:grid-cols-2 lg:grid-cols-3">
      {TICKERS.map((ticker) => {
        const data = tickerData.get(ticker);
        const latest = data?.latest;
        const sparkline = data?.sparkline ?? [];
        const changePct = latest?.change_pct ?? 0;
        const isPositive = changePct >= 0;
        const color = TICKER_COLORS[ticker as Ticker];

        return (
          <div key={ticker} className="relative bg-gray-950 p-3">
            {/* Header: ticker + change badge */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-sm" style={{ backgroundColor: color }} />
                <span className="text-xs font-bold tracking-wide text-gray-300">{ticker}</span>
              </div>
              <span
                className={`font-mono text-[11px] font-semibold ${
                  isPositive ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {latest ? formatPct(changePct) : '--'}
              </span>
            </div>

            {/* Chart area */}
            <div className="relative mt-1">
              {sparkline.length > 1 ? (
                <SparkLineChart
                  data={sparkline}
                  categories={['price']}
                  index="time"
                  colors={[isPositive ? 'emerald' : 'red']}
                  className="h-20 w-full"
                  curveType="monotone"
                  autoMinValue={true}
                />
              ) : (
                <div className="relative h-20 w-full overflow-hidden">
                  <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-gray-700 pulse-line" />
                  <div className="sweep-dot absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-500/50" />
                </div>
              )}

              {/* Price overlay bottom-right */}
              <div className="absolute bottom-0 right-0 bg-gray-950/80 px-1">
                <span className="font-mono text-sm font-bold text-gray-100">
                  {latest ? formatPrice(latest.current) : '--'}
                </span>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
