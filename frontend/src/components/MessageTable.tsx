import {
  Card,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeaderCell,
  TableRow,
} from '@tremor/react';
import { useMemo } from 'react';
import type { Quote } from '../types';

interface MessageTableProps {
  quotes: Quote[];
}

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

function formatPrice(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

function formatPct(n: number): string {
  const sign = n >= 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function MessageTable({ quotes }: MessageTableProps) {
  const rows = useMemo(() => {
    return [...quotes].reverse().slice(0, 50);
  }, [quotes]);

  return (
    <Card className="!bg-gray-900 !ring-gray-800">
      <h3 className="mb-3 text-sm font-medium text-gray-300 sm:text-base">Recent Messages</h3>

      {rows.length === 0 ? (
        <div className="flex h-32 items-center justify-center text-sm text-gray-500">
          No messages yet. Start the pipeline to see live data.
        </div>
      ) : (
        <div className="max-h-80 overflow-y-auto lg:max-h-96">
          <Table>
            <TableHead>
              <TableRow className="border-gray-800">
                <TableHeaderCell className="!text-gray-400">Time</TableHeaderCell>
                <TableHeaderCell className="!text-gray-400">Symbol</TableHeaderCell>
                <TableHeaderCell className="!text-gray-400 text-right">Price</TableHeaderCell>
                <TableHeaderCell className="!text-gray-400 text-right">Change</TableHeaderCell>
                <TableHeaderCell className="hidden !text-gray-400 text-right md:table-cell">
                  Open
                </TableHeaderCell>
                <TableHeaderCell className="hidden !text-gray-400 text-right md:table-cell">
                  High
                </TableHeaderCell>
                <TableHeaderCell className="hidden !text-gray-400 text-right md:table-cell">
                  Low
                </TableHeaderCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((q, i) => {
                const isPositive = q.change_pct >= 0;
                return (
                  <TableRow key={`${q.symbol}-${q.receivedAt}-${i}`} className="border-gray-800/50 even:bg-gray-800/20">
                    <TableCell className="font-mono text-xs !text-gray-400">
                      {formatTime(q.receivedAt)}
                    </TableCell>
                    <TableCell className="font-semibold !text-gray-200">{q.symbol}</TableCell>
                    <TableCell className="text-right font-mono !text-gray-200">
                      {formatPrice(q.current)}
                    </TableCell>
                    <TableCell
                      className={`text-right font-mono text-xs font-semibold ${
                        isPositive ? '!text-emerald-400' : '!text-red-400'
                      }`}
                    >
                      {formatPct(q.change_pct)}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs !text-gray-400 md:table-cell">
                      {formatPrice(q.open)}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs !text-gray-400 md:table-cell">
                      {formatPrice(q.high)}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs !text-gray-400 md:table-cell">
                      {formatPrice(q.low)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </Card>
  );
}
