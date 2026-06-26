import { useEffect, useState } from 'react';
import { startPipeline, stopPipeline } from '../api';
import type { PipelineStatus } from '../types';

interface ControlsProps {
  status: PipelineStatus | null;
  isConnected: boolean;
  onStatusUpdate: (s: PipelineStatus) => void;
}

export function Controls({ status, isConnected, onStatusUpdate }: ControlsProps) {
  const [loading, setLoading] = useState<'start' | 'stop' | null>(null);
  const [clock, setClock] = useState('--:--:--');

  useEffect(() => {
    const tick = () => setClock(new Date().toLocaleTimeString('en-US', { hour12: false }));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const pipelineRunning = (status?.producer?.running ?? false) || (status?.consumer?.running ?? false);

  const handleStart = async () => {
    setLoading('start');
    try {
      onStatusUpdate(await startPipeline());
    } catch {
      // surfaced via SSE/polling error
    } finally {
      setLoading(null);
    }
  };

  const handleStop = async () => {
    setLoading('stop');
    try {
      onStatusUpdate(await stopPipeline());
    } catch {
      // surfaced via SSE/polling error
    } finally {
      setLoading(null);
    }
  };

  const marketClosed = status?.market?.isOpen === false;

  return (
    <div className="hright">
      {marketClosed && <span className="pill closed">Market Closed</span>}
      <span className="clock mono">{clock}</span>
      <span className={`pill ${isConnected ? '' : 'poll'}`}>
        <span className="dot" />
        {isConnected ? 'SSE' : 'POLL'}
      </span>
      <button className="btn btn-stop" onClick={handleStop} disabled={loading !== null || !pipelineRunning}>
        {loading === 'stop' && <span className="spin" />}
        Stop
      </button>
      <button className="btn btn-start" onClick={handleStart} disabled={loading !== null || pipelineRunning}>
        {loading === 'start' && <span className="spin" />}
        Start
      </button>
    </div>
  );
}
