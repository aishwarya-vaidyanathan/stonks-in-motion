import { useMemo } from 'react';
import type { Quote } from '../types';
import { TICKER_COLORS } from '../types';
import { fmt, fmtUsd, pct } from '../lib/series';

interface MessageTableProps {
  quotes: Quote[];
}

function formatTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', { hour12: false });
  } catch {
    return ts;
  }
}

export function MessageTable({ quotes }: MessageTableProps) {
  // Newest first; the very latest row flashes on its direction.
  const rows = useMemo(() => [...quotes].reverse().slice(0, 100), [quotes]);
  const latestKey = quotes.length ? quotes[quotes.length - 1].receivedAt : null;

  return (
    <>
      <div className="seclabel reveal" style={{ animationDelay: '0.18s' }}>
        <h2>Recent Quotes</h2>
        <span className="meta">{rows.length} rows</span>
      </div>
      <div className="panel reveal" style={{ animationDelay: '0.20s' }}>
        <div className="tbl-wrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>Time</th>
                <th>Symbol</th>
                <th>Price</th>
                <th>Chg%</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Prev</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', padding: 40, color: 'var(--muted)' }}>
                    Waiting for quotes
                  </td>
                </tr>
              ) : (
                rows.map((q, i) => {
                  const up = q.change_pct >= 0;
                  const flash = i === 0 && q.receivedAt === latestKey ? (up ? 'flash-up' : 'flash-down') : '';
                  return (
                    <tr key={`${q.symbol}-${q.receivedAt}-${i}`} className={flash}>
                      <td className="num">{i + 1}</td>
                      <td style={{ color: 'var(--muted)' }}>{formatTime(q.receivedAt)}</td>
                      <td className="sym">
                        <i style={{ background: TICKER_COLORS[q.symbol as keyof typeof TICKER_COLORS] ?? 'var(--muted)' }} />
                        {q.symbol}
                      </td>
                      <td>{fmtUsd(q.current)}</td>
                      <td className={up ? 'up' : 'down'}>{pct(q.change_pct)}</td>
                      <td style={{ color: 'var(--muted)' }}>{fmt(q.open)}</td>
                      <td style={{ color: 'var(--muted)' }}>{fmt(q.high)}</td>
                      <td style={{ color: 'var(--muted)' }}>{fmt(q.low)}</td>
                      <td style={{ color: 'var(--muted)' }}>{fmt(q.prev_close)}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
