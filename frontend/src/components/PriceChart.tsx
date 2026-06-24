import { AreaChart, Card } from '@tremor/react';
import { useMemo, useState } from 'react';
import type { Quote, Ticker } from '../types';
import { TICKER_COLORS, TICKERS } from '../types';

interface PriceChartProps {
  quotes: Quote[];
}

type TimeRange = '1m' | '5m' | '15m' | 'all';

const RANGE_MINUTES: Record<TimeRange, number | null> = {
  '1m': 1,
  '5m': 5,
  '15m': 15,
  all: null,
};

function formatTime(ts: string): string {
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

export function PriceChart({ quotes }: PriceChartProps) {
  const [range, setRange] = useState<TimeRange>('all');

  const chartData = useMemo(() => {
    if (quotes.length === 0) return [];

    const rangeMinutes = RANGE_MINUTES[range];
    let filtered = quotes;
    if (rangeMinutes !== null) {
      const cutoff = Date.now() - rangeMinutes * 60 * 1000;
      filtered = quotes.filter((q) => {
        try {
          return new Date(q.receivedAt).getTime() >= cutoff;
        } catch {
          return true;
        }
      });
    }

    // Group by receivedAt (rounded to nearest second) so chart spreads over time
    const timeMap = new Map<string, Record<string, number | string>>();

    for (const q of filtered) {
      const d = new Date(q.receivedAt);
      const roundedKey = new Date(Math.round(d.getTime() / 1000) * 1000).toISOString();
      if (!timeMap.has(roundedKey)) {
        timeMap.set(roundedKey, { time: formatTime(q.receivedAt) });
      }
      const row = timeMap.get(roundedKey)!;
      row[q.symbol] = q.current;
    }

    const entries = Array.from(timeMap.entries());
    entries.sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime());

    return entries.map(([, row]) => row);
  }, [quotes, range]);

  const activeTickers = useMemo(() => {
    const present = new Set(quotes.map((q) => q.symbol));
    return TICKERS.filter((t) => present.has(t));
  }, [quotes]);

  const tremorColors = activeTickers.map((t) => {
    const hex = TICKER_COLORS[t as Ticker];
    const colorMap: Record<string, string> = {
      '#06b6d4': 'cyan',
      '#8b5cf6': 'violet',
      '#f59e0b': 'amber',
      '#10b981': 'emerald',
      '#6366f1': 'indigo',
      '#ef4444': 'red',
    };
    return colorMap[hex] ?? 'blue';
  });

  const ranges: TimeRange[] = ['1m', '5m', '15m', 'all'];

  return (
    <Card className="!bg-gray-900 !ring-gray-800">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-300 sm:text-base">Price History</h3>
        <div className="flex gap-1">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                range === r
                  ? 'bg-cyan-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:text-gray-200'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {chartData.length === 0 ? (
        <div className="flex h-48 items-center justify-center text-sm text-gray-500 sm:h-64 lg:h-80">
          Waiting for quote data...
        </div>
      ) : (
        <AreaChart
          className="h-48 sm:h-64 lg:h-80"
          data={chartData}
          index="time"
          categories={activeTickers}
          colors={tremorColors}
          curveType="monotone"
          showLegend={true}
          showGridLines={false}
          showAnimation={true}
          connectNulls={true}
          autoMinValue={true}
          yAxisWidth={65}
          valueFormatter={(n: number) =>
            n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
          }
        />
      )}
    </Card>
  );
}
