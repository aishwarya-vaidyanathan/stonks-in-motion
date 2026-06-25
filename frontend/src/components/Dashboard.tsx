import { useCallback, useEffect, useState } from 'react';
import type { PipelineStatus } from '../types';
import { useStream } from '../hooks/useStream';
import { Controls } from './Controls';
import { Hero } from './Hero';
import { MarketStrip } from './MarketStrip';
import { SymbolCards } from './SymbolCards';
import { PriceChart } from './PriceChart';
import { MessageTable } from './MessageTable';
import { TickerTape } from './TickerTape';

export function Dashboard() {
  const { status: streamStatus, quotes, isConnected, error } = useStream();
  const [status, setStatus] = useState<PipelineStatus | null>(null);

  useEffect(() => {
    if (streamStatus) setStatus(streamStatus);
  }, [streamStatus]);

  const handleStatusUpdate = useCallback((s: PipelineStatus) => setStatus(s), []);

  return (
    <>
      <header>
        <div className="wrap hbar">
          <div className="brand">
            <div className="logo" />
            <div className="wordmark">
              stonks<span>·</span>in<span>·</span>motion
            </div>
            <div className="hpipe">Finnhub → Kafka → SSE</div>
          </div>
          <Controls status={status} isConnected={isConnected} onStatusUpdate={handleStatusUpdate} />
        </div>
      </header>

      <main className="wrap">
        {error && <div className="errbar reveal">{error}</div>}

        <Hero quotes={quotes} status={status} />
        <MarketStrip quotes={quotes} />
        <SymbolCards quotes={quotes} />
        <PriceChart quotes={quotes} />
        <MessageTable quotes={quotes} />
      </main>

      <footer>stonks-in-motion · Finnhub → Aiven Kafka → Dashboard</footer>

      <TickerTape quotes={quotes} />
    </>
  );
}
