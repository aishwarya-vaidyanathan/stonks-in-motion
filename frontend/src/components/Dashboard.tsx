import { useCallback, useEffect, useState } from 'react';
import type { PipelineStatus } from '../types';
import { useStream } from '../hooks/useStream';
import { Controls } from './Controls';
import { KpiCards } from './KpiCards';
import { PriceChart } from './PriceChart';
import { MessageTable } from './MessageTable';
import { TickerTape } from './TickerTape';

export function Dashboard() {
  const { status: streamStatus, quotes, isConnected, error } = useStream();
  const [status, setStatus] = useState<PipelineStatus | null>(null);

  useEffect(() => {
    if (streamStatus) {
      setStatus(streamStatus);
    }
  }, [streamStatus]);

  const handleStatusUpdate = useCallback((s: PipelineStatus) => {
    setStatus(s);
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-950 to-gray-900">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-gray-800/80 bg-gray-950/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-gray-100 sm:text-lg">
              stonks-in-motion
            </h1>
            <span className="rounded-full bg-gray-800 px-2 py-0.5 text-[10px] font-medium text-gray-400">
              Finnhub &rarr; Kafka
            </span>
          </div>
          <Controls
            status={status}
            isConnected={isConnected}
            onStatusUpdate={handleStatusUpdate}
          />
        </div>
      </header>

      {/* Main content */}
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4 pb-14 sm:px-6 lg:space-y-6 lg:px-8 lg:py-6">
        {/* Error banner */}
        {error && (
          <div className="rounded-md bg-amber-900/30 px-3 py-2 text-xs text-amber-300">
            {error}
          </div>
        )}

        <KpiCards quotes={quotes} status={status} />
        <PriceChart quotes={quotes} />
        <MessageTable quotes={quotes} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800/50 pb-12 pt-4">
        <p className="text-center text-[10px] text-gray-600 sm:text-xs">
          stonks-in-motion &middot; Finnhub &rarr; Aiven Kafka &rarr; Dashboard
        </p>
      </footer>

      {/* Live ticker tape */}
      <TickerTape quotes={quotes} />
    </div>
  );
}
