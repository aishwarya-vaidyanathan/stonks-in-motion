import { LineChart } from '@tremor/react';
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
    return new Date(ts).toLocaleTimeString('en-US', {
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
    const timeMap = new Map<string, Record<string, number | string>>();
    for (const q of filtered) {
      const d = new Date(q.receivedAt);
      const roundedKey = new Date(Math.round(d.getTime() / 1000) * 1000).toISOString();
      if (!timeMap.has(roundedKey)) {
        timeMap.set(roundedKey, { time: formatTime(q.receivedAt) });
      }
      timeMap.get(roundedKey)![q.symbol] = q.current;
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
    <div className="border border-gray-800 bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <h3 className="text-xs font-bold tracking-wide text-gray-400">PRICE HISTORY</h3>
        <div className="flex gap-0.5">
          {ranges.map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-2 py-0.5 text-[10px] font-bold tracking-wide transition-colors ${
                range === r
                  ? 'bg-cyan-600 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {r.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <div className="p-3">
        {chartData.length === 0 ? (
          <div className="relative flex h-48 flex-col items-center justify-center sm:h-64 lg:h-72">
            <svg className="pulse-line absolute inset-0 h-full w-full" preserveAspectRatio="none">
              <line x1="0" y1="50%" x2="100%" y2="50%" stroke="#06b6d4" strokeWidth="1" strokeOpacity="0.2" strokeDasharray="8 4" />
            </svg>
            <div className="relative z-10 text-center">
              <p className="font-mono text-xs text-gray-500">No market data</p>
              <p className="mt-1 text-[10px] text-gray-600">Start the pipeline to see live prices</p>
            </div>
          </div>
        ) : (
          <LineChart
            className="h-48 sm:h-64 lg:h-72"
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
      </div>
    </div>
  );
}
