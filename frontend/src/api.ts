import type { HealthResponse, LogsResponse, PipelineStatus, Quote } from './types';

export const API_URL = import.meta.env.VITE_API_URL || 'https://stonks-in-motion.onrender.com';

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  });
  if (!res.ok) {
    throw new Error(`API ${path}: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export function startPipeline(): Promise<PipelineStatus> {
  return request<PipelineStatus>('/api/start', { method: 'POST' });
}

export function stopPipeline(): Promise<PipelineStatus> {
  return request<PipelineStatus>('/api/stop', { method: 'POST' });
}

export function getStatus(): Promise<PipelineStatus> {
  return request<PipelineStatus>('/api/status');
}

export function getLogs(tail = 50): Promise<LogsResponse> {
  return request<LogsResponse>(`/api/logs?tail=${tail}`);
}

export function getQuotesHistory(tail = 200): Promise<Quote[]> {
  return request<Quote[]>(`/api/quotes/history?tail=${tail}`);
}

export async function checkHealth(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${API_URL}/healthz`, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return false;
    const data = (await res.json()) as HealthResponse;
    return data.ok === true;
  } catch {
    return false;
  }
}

export function streamUrl(): string {
  return `${API_URL}/api/stream`;
}
