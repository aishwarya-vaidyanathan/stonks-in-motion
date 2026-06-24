import { useCallback, useEffect, useRef, useState } from 'react';
import { getQuotesHistory, getStatus, streamUrl } from '../api';
import type { PipelineStatus, Quote } from '../types';

const MAX_QUOTES = 500;

interface UseStreamReturn {
  status: PipelineStatus | null;
  quotes: Quote[];
  isConnected: boolean;
  error: string | null;
}

export function useStream(): UseStreamReturn {
  const [status, setStatus] = useState<PipelineStatus | null>(null);
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  const addQuote = useCallback((q: Quote) => {
    const stamped = { ...q, receivedAt: q.receivedAt || new Date().toISOString() };
    setQuotes((prev) => {
      const next = [...prev, stamped];
      return next.length > MAX_QUOTES ? next.slice(-MAX_QUOTES) : next;
    });
  }, []);

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    stopPolling();
    const poll = async () => {
      try {
        const [s, history] = await Promise.all([getStatus(), getQuotesHistory(50)]);
        setStatus(s);
        const now = new Date().toISOString();
        const stamped = history.map((q) => ({ ...q, receivedAt: q.receivedAt || now }));
        setQuotes((prev) => {
          const merged = [...prev, ...stamped];
          return merged.length > MAX_QUOTES ? merged.slice(-MAX_QUOTES) : merged;
        });
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Polling failed');
      }
    };
    poll(); // immediate first poll
    pollingRef.current = setInterval(poll, 3000);
  }, [stopPolling]);

  const connectSSE = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
    }

    const es = new EventSource(streamUrl());
    eventSourceRef.current = es;

    es.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data) as PipelineStatus;
        setStatus(data);
      } catch {
        // ignore malformed events
      }
    });

    es.addEventListener('quote', (e) => {
      try {
        const data = JSON.parse(e.data) as Quote;
        addQuote(data);
      } catch {
        // ignore malformed events
      }
    });

    es.onopen = () => {
      setIsConnected(true);
      setError(null);
      stopPolling();
    };

    es.onerror = () => {
      setIsConnected(false);
      es.close();
      eventSourceRef.current = null;
      setError('SSE disconnected, falling back to polling');
      startPolling();
      // Try to reconnect SSE after 10s
      setTimeout(() => {
        if (!eventSourceRef.current) {
          connectSSE();
        }
      }, 10000);
    };
  }, [addQuote, stopPolling, startPolling]);

  // Load initial history on mount
  useEffect(() => {
    getQuotesHistory(200)
      .then((history) => {
        const now = new Date().toISOString();
        setQuotes(history.map((q) => ({ ...q, receivedAt: q.receivedAt || now })));
      })
      .catch(() => {});
  }, []);

  // Start SSE connection
  useEffect(() => {
    connectSSE();
    return () => {
      eventSourceRef.current?.close();
      eventSourceRef.current = null;
      stopPolling();
    };
  }, [connectSSE, stopPolling]);

  return { status, quotes, isConnected, error };
}
