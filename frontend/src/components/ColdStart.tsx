import { useEffect, useState } from 'react';
import { checkHealth } from '../api';

interface ColdStartProps {
  onReady: () => void;
}

export function ColdStart({ onReady }: ColdStartProps) {
  const [attempts, setAttempts] = useState(0);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const ping = async () => {
      const healthy = await checkHealth();
      if (cancelled) return;

      if (healthy) {
        setFading(true);
        setTimeout(() => {
          if (!cancelled) onReady();
        }, 500);
      } else {
        setAttempts((a) => a + 1);
        setTimeout(() => {
          if (!cancelled) ping();
        }, 3000);
      }
    };

    ping();
    return () => {
      cancelled = true;
    };
  }, [onReady]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center bg-gray-950 transition-opacity duration-500 ${
        fading ? 'opacity-0' : 'opacity-100'
      }`}
    >
      <div className="flex flex-col items-center gap-6">
        {/* Spinner */}
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />

        <h2 className="text-xl font-semibold text-gray-100">
          Waking up the pipeline backend...
        </h2>

        <p className="text-sm text-gray-400">
          Render.com free tier spins down after inactivity. This takes 30-60 seconds.
        </p>

        {attempts > 0 && (
          <p className="text-xs text-gray-500">
            Attempt {attempts}... still waiting
          </p>
        )}
      </div>
    </div>
  );
}
