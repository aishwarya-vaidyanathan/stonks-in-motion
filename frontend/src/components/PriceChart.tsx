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

    // Filter by time range
    const rangeMinutes = RANGE_MINUTES[range];
    let filtered = quotes;
    if (rangeMinutes !== null) {
      const cutoff = Date.now() - rangeMinutes * 60 * 1000;
      filtered = quotes.filter((q) => {
        try {
          return new Date(q.ts).getTime() >= cutoff;
        } catch {
          return true;
        }
      });
    }

    // Group by timestamp and pivot tickers into columns
    const timeMap = new Map<string, Record<string, number | string>>();

    for (const q of filtered) {
      const timeKey = q.ts;
      if (!timeMap.has(timeKey)) {
        timeMap.set(timeKey, { time: formatTime(timeKey) });
      }
      const row = timeMap.get(timeKey)!;
      row[q.symbol] = q.current;
    }

    // Sort by original timestamp
    const entries = Array.from(timeMap.entries());
    entries.sort(([a], [b]) => {
      try {
        return new Date(a).getTime() - new Date(b).getTime();
      } catch {
        return 0;
      }
    });

    return entries.map(([, row]) => row);
  }, [quotes, range]);

  // Determine which tickers are actually present in the data
  const activeTickers = useMemo(() => {
    const present = new Set(quotes.map((q) => q.symbol));
    return TICKERS.filter((t) => present.has(t));
  }, [quotes]);

  const tremorColors = activeTickers.map((t) => {
    const hex = TICKER_COLORS[t as Ticker];
    // Map hex to closest Tremor color name
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
        <h3 className="text-sm font-medium text-gray-300">Price History</h3>
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
        <div className="flex h-64 items-center justify-center text-sm text-gray-500">
          Waiting for quote data...
        </div>
      ) : (
        <AreaChart
          className="h-64"
          data={chartData}
          index="time"
          categories={activeTickers}
          colors={tremorColors}
          curveType="monotone"
          showLegend={true}
          showGridLines={false}
          showAnimation={true}
          connectNulls={true}
          yAxisWidth={65}
          valueFormatter={(n: number) =>
            n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
          }
        />
      )}
    </Card>
  );
}
