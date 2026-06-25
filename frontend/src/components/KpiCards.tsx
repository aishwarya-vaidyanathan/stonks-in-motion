import { Card, SparkLineChart } from '@tremor/react';
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
      const sparkline = tickerQuotes.slice(-30).map((q) => ({
        time: q.receivedAt,
        price: q.current,
      }));
      map.set(ticker, { latest, sparkline });
    }

    return map;
  }, [quotes]);

  const totalMessages = quotes.length;
  const producerUptime = status?.producer?.uptime_seconds;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4 xl:grid-cols-7">
      {TICKERS.map((ticker) => {
        const data = tickerData.get(ticker);
        const latest = data?.latest;
        const sparkline = data?.sparkline ?? [];
        const changePct = latest?.change_pct ?? 0;
        const isPositive = changePct >= 0;

        return (
          <Card key={ticker} className="!bg-gray-900 !ring-gray-800 border-l-2 p-3" style={{ borderLeftColor: TICKER_COLORS[ticker as Ticker] }}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold tracking-wide text-gray-400">{ticker}</p>
              <span
                className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  isPositive
                    ? 'bg-emerald-400/10 text-emerald-400'
                    : 'bg-red-400/10 text-red-400'
                }`}
              >
                {latest ? formatPct(changePct) : '--'}
              </span>
            </div>
            <p className="mt-1 text-lg font-bold text-gray-100 sm:text-xl">
              {latest ? formatPrice(latest.current) : '--'}
            </p>
            {sparkline.length > 1 && (
              <SparkLineChart
                data={sparkline}
                categories={['price']}
                index="time"
                colors={[isPositive ? 'emerald' : 'red']}
                className="mt-2 h-10 w-full"
                curveType="monotone"
                autoMinValue={true}
              />
            )}
            {sparkline.length <= 1 && (
              <div className="relative mt-2 h-10 w-full overflow-hidden">
                {/* Animated flatline with sweep dot */}
                <div className="absolute inset-y-1/2 left-0 right-0 h-px bg-gray-700 pulse-line" />
                <div className="sweep-dot absolute top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-cyan-500/50" />
              </div>
            )}
          </Card>
        );
      })}

      {/* Pipeline stats card */}
      <Card className="!bg-gray-900 !ring-gray-800/50 border border-cyan-900/30 p-3">
        <p className="text-xs font-semibold tracking-wide text-cyan-400">Pipeline</p>
        <div className="mt-3 space-y-2">
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
