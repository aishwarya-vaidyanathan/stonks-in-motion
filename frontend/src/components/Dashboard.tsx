import { useCallback, useEffect, useState } from 'react';
import type { PipelineStatus } from '../types';
import { useStream } from '../hooks/useStream';
import { Controls } from './Controls';
import { KpiCards } from './KpiCards';
import { PriceChart } from './PriceChart';
import { MessageTable } from './MessageTable';

export function Dashboard() {
  const { status: streamStatus, quotes, isConnected, error } = useStream();
  const [status, setStatus] = useState<PipelineStatus | null>(null);

  // Merge SSE status updates with manual control updates
  useEffect(() => {
    if (streamStatus) {
      setStatus(streamStatus);
    }
  }, [streamStatus]);

  const handleStatusUpdate = useCallback((s: PipelineStatus) => {
    setStatus(s);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-gray-100">
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
      <main className="mx-auto max-w-7xl space-y-4 px-4 py-4">
        {/* Error banner */}
        {error && (
          <div className="rounded-md bg-amber-900/30 px-3 py-2 text-xs text-amber-300">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        <KpiCards quotes={quotes} status={status} />

        {/* Price Chart */}
        <PriceChart quotes={quotes} />

        {/* Message Table */}
        <MessageTable quotes={quotes} />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-3 text-center text-xs text-gray-600">
        stonks-in-motion &middot; Finnhub &rarr; Aiven Kafka &rarr; Dashboard
      </footer>
    </div>
  );
}
