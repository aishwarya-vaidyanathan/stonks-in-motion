/** A single stock quote from the Finnhub pipeline. */
export interface Quote {
  symbol: string;
  ts: string;
  current: number;
  open: number;
  high: number;
  low: number;
  prev_close: number;
  change: number;
  change_pct: number;
}

/** Status of an individual subprocess (producer or consumer). */
export interface SubprocessStatus {
  running: boolean;
  pid: number | null;
  started_at: string | null;
  uptime_seconds: number | null;
  log_file: string | null;
}

/** Full pipeline status returned by /api/status and SSE "status" events. */
export interface PipelineStatus {
  producer: SubprocessStatus;
  consumer: SubprocessStatus;
}

/** Response from /api/logs. */
export interface LogsResponse {
  log_path: string;
  lines: string[];
}

/** Health check response from /healthz. */
export interface HealthResponse {
  ok: boolean;
}

/** Ticker symbols tracked by the pipeline. */
export const TICKERS = ['AAPL', 'MSFT', 'GOOG', 'AMZN', 'NVDA', 'TSLA'] as const;
export type Ticker = (typeof TICKERS)[number];

/** Color map for each ticker in charts. */
export const TICKER_COLORS: Record<Ticker, string> = {
  AAPL: '#06b6d4',  // cyan
  MSFT: '#8b5cf6',  // violet
  GOOG: '#f59e0b',  // amber
  AMZN: '#10b981',  // emerald
  NVDA: '#6366f1',  // indigo
  TSLA: '#ef4444',  // red
};
