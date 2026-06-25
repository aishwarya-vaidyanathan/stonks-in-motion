import { useMemo } from 'react';
import type { Quote } from '../types';

interface MessageTableProps {
  quotes: Quote[];
}

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

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function MessageTable({ quotes }: MessageTableProps) {
  const rows = useMemo(() => [...quotes].reverse().slice(0, 100), [quotes]);

  return (
    <div className="border border-gray-800 bg-gray-950">
      <div className="flex items-center justify-between border-b border-gray-800 px-3 py-2">
        <h3 className="text-xs font-bold tracking-wide text-gray-400">RECENT QUOTES</h3>
        <span className="font-mono text-[10px] text-gray-600">{rows.length} rows</span>
      </div>

      {rows.length === 0 ? (
        <div className="flex h-32 flex-col items-center justify-center gap-2">
          <div className="flex items-center gap-1.5">
            <div className="h-1.5 w-1.5 rounded-full bg-gray-600 pulse-line" />
            <div className="h-1.5 w-1.5 rounded-full bg-gray-600 pulse-line" style={{ animationDelay: '0.5s' }} />
            <div className="h-1.5 w-1.5 rounded-full bg-gray-600 pulse-line" style={{ animationDelay: '1s' }} />
          </div>
          <p className="text-xs text-gray-500">Waiting for quotes</p>
        </div>
      ) : (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 z-10 bg-gray-900 text-gray-500">
              <tr className="border-b border-gray-800">
                <th className="px-2 py-1.5 font-medium">#</th>
                <th className="px-2 py-1.5 font-medium">Time</th>
                <th className="px-2 py-1.5 font-medium">Symbol</th>
                <th className="px-2 py-1.5 text-right font-medium">Price</th>
                <th className="px-2 py-1.5 text-right font-medium">Change %</th>
                <th className="px-2 py-1.5 text-right font-medium">Open</th>
                <th className="px-2 py-1.5 text-right font-medium">High</th>
                <th className="px-2 py-1.5 text-right font-medium">Low</th>
                <th className="px-2 py-1.5 text-right font-medium">Prev Close</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((q, i) => {
                const isPositive = q.change_pct >= 0;
                return (
                  <tr
                    key={`${q.symbol}-${q.receivedAt}-${i}`}
                    className="border-b border-gray-800/30 even:bg-gray-900/40 hover:bg-gray-800/50"
                  >
                    <td className="px-2 py-1 font-mono text-gray-600">{i + 1}</td>
                    <td className="px-2 py-1 font-mono text-gray-400">{formatTime(q.receivedAt)}</td>
                    <td className="px-2 py-1 font-bold text-gray-200">{q.symbol}</td>
                    <td className="px-2 py-1 text-right font-mono text-gray-200">{formatPrice(q.current)}</td>
                    <td className={`px-2 py-1 text-right font-mono font-semibold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                      {formatPct(q.change_pct)}
                    </td>
                    <td className="px-2 py-1 text-right font-mono text-gray-400">{formatPrice(q.open)}</td>
                    <td className="px-2 py-1 text-right font-mono text-gray-400">{formatPrice(q.high)}</td>
                    <td className="px-2 py-1 text-right font-mono text-gray-400">{formatPrice(q.low)}</td>
                    <td className="px-2 py-1 text-right font-mono text-gray-400">{formatPrice(q.prev_close)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
