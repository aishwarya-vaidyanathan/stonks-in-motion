import { useCallback, useEffect, useState } from 'react';
import type { PipelineStatus } from '../types';
import { useStream } from '../hooks/useStream';
import { useReference } from '../hooks/useReference';
import { Controls } from './Controls';
import { Hero } from './Hero';
import { MarketStrip } from './MarketStrip';
import { SymbolCards } from './SymbolCards';
import { PriceChart } from './PriceChart';
import { RecommendationsPanel } from './RecommendationsPanel';
import { NewsPanel } from './NewsPanel';
import { MessageTable } from './MessageTable';
import { TickerTape } from './TickerTape';

export function Dashboard() {
  const { status: streamStatus, quotes, isConnected, error } = useStream();
  const { profiles, metrics, recommendations, news } = useReference();
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
              Stonks <span>in</span> Motion
            </div>
            <div className="hpipe">Finnhub → Kafka → SSE</div>
          </div>
          <Controls status={status} isConnected={isConnected} onStatusUpdate={handleStatusUpdate} />
        </div>
      </header>

      <main className="wrap">
        {error && <div className="errbar reveal">{error}</div>}

        <Hero quotes={quotes} status={status} />
        <MarketStrip quotes={quotes} profiles={profiles} />
        <SymbolCards quotes={quotes} profiles={profiles} metrics={metrics} />
        <PriceChart quotes={quotes} />
        <RecommendationsPanel recommendations={recommendations} />
        <NewsPanel news={news} />
        <MessageTable quotes={quotes} profiles={profiles} />
      </main>

      <footer>Stonks in Motion · Finnhub → Kafka → Dashboard</footer>

      <TickerTape quotes={quotes} />
    </>
  );
}
