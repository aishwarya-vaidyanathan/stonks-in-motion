import { Card, SparkAreaChart } from '@tremor/react';
import type { PipelineStatus, Quote, Ticker } from '../types';
import { TICKER_COLORS, TICKERS } from '../types';
import { useMemo } from 'react';

interface KpiCardsProps {
  quotes: Quote[];
  status: PipelineStatus | null;
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

function formatUptime(seconds: number | null | undefined): string {
  if (!seconds) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h ${m}m`;
}

export function KpiCards({ quotes, status }: KpiCardsProps) {
  const tickerData = useMemo(() => {
    const map = new Map<string, TickerData>();

    for (const ticker of TICKERS) {
      const tickerQuotes = quotes.filter((q) => q.symbol === ticker);
      const latest = tickerQuotes.length > 0 ? tickerQuotes[tickerQuotes.length - 1] : null;
      const sparkline = tickerQuotes.slice(-20).map((q) => ({
        time: q.ts,
        price: q.current,
      }));
      map.set(ticker, { latest, sparkline });
    }

    return map;
  }, [quotes]);

  const totalMessages = quotes.length;
  const producerUptime = status?.producer?.uptime_seconds;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
      {TICKERS.map((ticker) => {
        const data = tickerData.get(ticker);
        const latest = data?.latest;
        const sparkline = data?.sparkline ?? [];
        const changePct = latest?.change_pct ?? 0;
        const isPositive = changePct >= 0;
        const color = TICKER_COLORS[ticker as Ticker];

        return (
          <Card key={ticker} className="!bg-gray-900 !ring-gray-800 p-3">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-medium text-gray-400">{ticker}</p>
                <p className="mt-1 text-lg font-semibold text-gray-100">
                  {latest ? formatPrice(latest.current) : '--'}
                </p>
              </div>
              {sparkline.length > 1 && (
                <SparkAreaChart
                  data={sparkline}
                  categories={['price']}
                  index="time"
                  colors={[isPositive ? 'emerald' : 'red']}
                  className="h-8 w-16"
                  curveType="monotone"
                />
              )}
            </div>
            <p
              className={`mt-1 text-xs font-medium ${
                isPositive ? 'text-emerald-400' : 'text-red-400'
              }`}
              style={{ color: latest ? undefined : color }}
            >
              {latest ? formatPct(changePct) : 'No data'}
            </p>
          </Card>
        );
      })}

      {/* Pipeline stats card */}
      <Card className="!bg-gray-900 !ring-gray-800 p-3">
        <p className="text-xs font-medium text-gray-400">Pipeline</p>
        <div className="mt-2 space-y-1">
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Uptime</span>
            <span className="font-mono text-gray-300">{formatUptime(producerUptime)}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Messages</span>
            <span className="font-mono text-gray-300">{totalMessages}</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-gray-500">Tickers</span>
            <span className="font-mono text-gray-300">
              {new Set(quotes.map((q) => q.symbol)).size}
            </span>
          </div>
        </div>
      </Card>
    </div>
  );
}
