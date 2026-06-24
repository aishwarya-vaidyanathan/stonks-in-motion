import { useState } from 'react';
import { startPipeline, stopPipeline } from '../api';
import type { PipelineStatus } from '../types';

interface ControlsProps {
  status: PipelineStatus | null;
  isConnected: boolean;
  onStatusUpdate: (s: PipelineStatus) => void;
}

export function Controls({ status, isConnected, onStatusUpdate }: ControlsProps) {
  const [loading, setLoading] = useState<'start' | 'stop' | null>(null);

  const producerRunning = status?.producer?.running ?? false;
  const consumerRunning = status?.consumer?.running ?? false;
  const pipelineRunning = producerRunning || consumerRunning;

  const handleStart = async () => {
    setLoading('start');
    try {
      const result = await startPipeline();
      onStatusUpdate(result);
    } catch {
      // Error handled by SSE/polling
    } finally {
      setLoading(null);
    }
  };

  const handleStop = async () => {
    setLoading('stop');
    try {
      const result = await stopPipeline();
      onStatusUpdate(result);
    } catch {
      // Error handled by SSE/polling
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex items-center gap-3">
      {/* Status dot */}
      <div className="flex items-center gap-2">
        <div
          className={`h-2.5 w-2.5 rounded-full ${
            pipelineRunning
              ? 'bg-emerald-400 shadow-[0_0_6px_rgba(52,211,153,0.6)]'
              : 'bg-gray-500'
          }`}
        />
        <span className="text-xs text-gray-400">
          {pipelineRunning ? 'Running' : 'Stopped'}
        </span>
      </div>

      {/* Connection indicator */}
      <div className="flex items-center gap-1.5">
        <div
          className={`h-1.5 w-1.5 rounded-full ${
            isConnected ? 'bg-cyan-400' : 'bg-amber-400'
          }`}
        />
        <span className="text-xs text-gray-500">
          {isConnected ? 'SSE' : 'Polling'}
        </span>
      </div>

      {/* Buttons */}
      <button
        onClick={handleStart}
        disabled={loading !== null || pipelineRunning}
        className="rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading === 'start' ? 'Starting...' : 'Start'}
      </button>
      <button
        onClick={handleStop}
        disabled={loading !== null || !pipelineRunning}
        className="rounded-md bg-red-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {loading === 'stop' ? 'Stopping...' : 'Stop'}
      </button>
    </div>
  );
}
