import type { Recommendation } from '../types';
import { TICKERS } from '../types';

interface RecommendationsPanelProps {
  recommendations: Record<string, Recommendation>;
}

const BUCKETS: { key: keyof Recommendation; cls: string; label: string }[] = [
  { key: 'strongBuy', cls: 'sbuy', label: 'Strong Buy' },
  { key: 'buy', cls: 'buy', label: 'Buy' },
  { key: 'hold', cls: 'hold', label: 'Hold' },
  { key: 'sell', cls: 'sell', label: 'Sell' },
  { key: 'strongSell', cls: 'ssell', label: 'Strong Sell' },
];

function consensus(r: Recommendation): { label: string; cls: string } {
  const buy = r.strongBuy + r.buy;
  const sell = r.sell + r.strongSell;
  if (buy >= r.hold && buy >= sell) return { label: 'Buy', cls: 'up' };
  if (sell > buy && sell >= r.hold) return { label: 'Sell', cls: 'down' };
  return { label: 'Hold', cls: '' };
}

export function RecommendationsPanel({ recommendations }: RecommendationsPanelProps) {
  const rows = TICKERS.map((sym) => [sym, recommendations[sym]] as const).filter(
    ([, r]) => r && r.strongBuy + r.buy + r.hold + r.sell + r.strongSell > 0,
  );

  return (
    <>
      <div className="seclabel reveal" style={{ animationDelay: '0.22s' }}>
        <h2>Analyst Ratings</h2>
        <span className="meta">{rows[0]?.[1]?.period ?? 'latest'}</span>
      </div>
      <div className="panel reveal" style={{ animationDelay: '0.24s' }}>
        {rows.length === 0 ? (
          <div className="empty-flat" style={{ height: 120 }}>
            <span className="empty-msg">No analyst data available</span>
          </div>
        ) : (
          <div className="rec-list">
            {rows.map(([sym, r]) => {
              const total = r.strongBuy + r.buy + r.hold + r.sell + r.strongSell;
              const c = consensus(r);
              return (
                <div className="rec-row" key={sym}>
                  <div className="rec-sym">{sym}</div>
                  <div className="rec-bar">
                    {BUCKETS.map((b) => {
                      const v = r[b.key] as number;
                      if (!v) return null;
                      return (
                        <span
                          key={b.cls}
                          className={`rec-seg ${b.cls}`}
                          style={{ width: `${(v / total) * 100}%` }}
                          title={`${b.label}: ${v}`}
                        />
                      );
                    })}
                  </div>
                  <div className={`rec-consensus ${c.cls}`}>
                    {c.label} <span className="rec-total">{total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
