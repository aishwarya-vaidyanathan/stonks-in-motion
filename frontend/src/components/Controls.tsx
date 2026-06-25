import { useState } from 'react';
import { startPipeline, stopPipeline } from '../api';
import type { PipelineStatus } from '../types';

interface ControlsProps {
  status: PipelineStatus | null;
  isConnected: boolean;
  onStatusUpdate: (s: PipelineStatus) => void;
}

function formatUptime(seconds: number | null | undefined): string {
  if (!seconds) return '0s';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  const h = Math.floor(seconds / 3600);
  const m = Math.round((seconds % 3600) / 60);
  return `${h}h${m}m`;
}

export function Controls({ status, isConnected, onStatusUpdate }: ControlsProps) {
  const [loading, setLoading] = useState<'start' | 'stop' | null>(null);

  const producerRunning = status?.producer?.running ?? false;
  const consumerRunning = status?.consumer?.running ?? false;
  const pipelineRunning = producerRunning || consumerRunning;

  const handleStart = async () => {
    setLoading('start');
    try {
      onStatusUpdate(await startPipeline());
    } catch {
      // Error handled by SSE/polling
    } finally {
      setLoading(null);
    }
  };

  const handleStop = async () => {
    setLoading('stop');
    try {
      onStatusUpdate(await stopPipeline());
    } catch {
      // Error handled by SSE/polling
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-2 text-[10px] sm:gap-3">
      {/* Pipeline stats */}
      <div className="hidden items-center gap-3 font-mono text-gray-500 sm:flex">
        <span>UP {formatUptime(status?.producer?.uptime_seconds)}</span>
        <span className={isConnected ? 'text-cyan-500' : 'text-amber-500'}>
          {isConnected ? 'SSE' : 'POLL'}
        </span>
      </div>

      {/* Status dot */}
      <div
        className={`h-2 w-2 rounded-full ${
          pipelineRunning
            ? 'bg-emerald-400 shadow-[0_0_4px_rgba(52,211,153,0.6)]'
            : 'bg-gray-600'
        }`}
      />

      {/* Buttons */}
      <button
        onClick={handleStart}
        disabled={loading !== null || pipelineRunning}
        className="border border-emerald-600 px-2 py-0.5 font-bold text-emerald-400 transition-colors hover:bg-emerald-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        {loading === 'start' ? 'STARTING' : 'START'}
      </button>
      <button
        onClick={handleStop}
        disabled={loading !== null || !pipelineRunning}
        className="border border-red-600 px-2 py-0.5 font-bold text-red-400 transition-colors hover:bg-red-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-30"
      >
        {loading === 'stop' ? 'STOPPING' : 'STOP'}
      </button>
    </div>
  );
}
