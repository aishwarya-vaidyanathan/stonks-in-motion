import { useState } from 'react';

interface SymbolLogoProps {
  symbol: string;
  logo: string | null | undefined;
  color: string;
  size?: number;
}

/**
 * Company logo with a colored ring (TICKER_COLORS) for identity. Falls back to
 * a plain colored dot when no logo is available or the image fails to load.
 */
export function SymbolLogo({ symbol, logo, color, size = 18 }: SymbolLogoProps) {
  const [ok, setOk] = useState(true);

  if (logo && ok) {
    return (
      <img
        className="sym-logo"
        src={logo}
        alt={symbol}
        width={size}
        height={size}
        style={{ boxShadow: `0 0 0 1.5px ${color}` }}
        onError={() => setOk(false)}
      />
    );
  }

  const dot = Math.round(size * 0.42);
  return <i className="sym-dot" style={{ background: color, width: dot, height: dot }} />;
}
