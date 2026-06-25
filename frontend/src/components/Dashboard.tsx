import { useCallback, useEffect, useMemo, useState } from 'react';
import type { PipelineStatus } from '../types';
import { TICKERS } from '../types';
import { useStream } from '../hooks/useStream';
import { Controls } from './Controls';
import { KpiCards } from './KpiCards';
import { MarketStrip } from './MarketStrip';
import { PriceChart } from './PriceChart';
import { MessageTable } from './MessageTable';
import { TickerTape } from './TickerTape';

export function Dashboard() {
  const { status: streamStatus, quotes, isConnected, error } = useStream();
  const [status, setStatus] = useState<PipelineStatus | null>(null);

  useEffect(() => {
    if (streamStatus) setStatus(streamStatus);
  }, [streamStatus]);

  const handleStatusUpdate = useCallback((s: PipelineStatus) => {
    setStatus(s);
  }, []);

  // Market breadth: count advancing vs declining tickers
  const breadth = useMemo(() => {
    if (quotes.length === 0) return null;
    let advancing = 0;
    let declining = 0;
    for (const ticker of TICKERS) {
      const latest = [...quotes].reverse().find((q) => q.symbol === ticker);
      if (!latest) continue;
      if (latest.change_pct >= 0) advancing++;
      else declining++;
    }
    const total = advancing + declining;
    return { advancing, declining, total, advPct: total > 0 ? (advancing / total) * 100 : 50 };
  }, [quotes]);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-800 bg-gray-950/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-2 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2">
            <h1 className="text-sm font-bold text-gray-100">stonks-in-motion</h1>
            <span className="border border-gray-700 px-1.5 py-0.5 text-[9px] font-medium text-gray-500">
              FINNHUB &rarr; KAFKA
            </span>
          </div>
          <Controls
            status={status}
            isConnected={isConnected}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>
      </header>

      {/* Market strip */}
      <MarketStrip quotes={quotes} />

      {/* Error banner */}
      {error && (
        <div className="border-b border-amber-800/30 bg-amber-900/20 px-4 py-1.5 text-[11px] text-amber-300">
          {error}
        </div>
      )}

      {/* Main content */}
      <main className="mx-auto max-w-7xl space-y-2 px-4 py-3 pb-14 sm:px-6 lg:px-8">
        {/* Chart panels */}
        <KpiCards quotes={quotes} />

        {/* Market breadth bar */}
        {breadth ? (
          <div className="flex items-center gap-3 border border-gray-800 bg-gray-950 px-3 py-2">
            <span className="text-[10px] font-bold text-emerald-400">
              Advancing {breadth.advancing} ({breadth.advPct.toFixed(1)}%)
            </span>
            <div className="flex h-1.5 flex-1 overflow-hidden bg-gray-800">
              <div
                className="bg-emerald-500 transition-all duration-500"
                style={{ width: `${breadth.advPct}%` }}
              />
              <div className="flex-1 bg-red-500" />
            </div>
            <span className="text-[10px] font-bold text-red-400">
              Declining {breadth.declining} ({(100 - breadth.advPct).toFixed(1)}%)
            </span>
          </div>
        ) : (
          <div className="border border-gray-800 bg-gray-950 px-3 py-2 text-center text-[10px] text-gray-600">
            Awaiting market data
          </div>
        )}

        <PriceChart quotes={quotes} />
        <MessageTable quotes={quotes} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 pb-12 pt-3">
        <p className="text-center text-[9px] tracking-wide text-gray-600">
          STONKS-IN-MOTION &middot; FINNHUB &rarr; AIVEN KAFKA &rarr; DASHBOARD
        </p>
      </footer>

      <TickerTape quotes={quotes} />
    </div>
  );
}
