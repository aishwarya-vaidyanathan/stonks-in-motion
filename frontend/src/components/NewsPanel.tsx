import type { NewsItem } from '../types';
import { TICKER_COLORS } from '../types';

interface NewsPanelProps {
  news: NewsItem[];
}

function relTime(unixSeconds: number | null): string {
  if (!unixSeconds) return '';
  const diff = Date.now() / 1000 - unixSeconds;
  if (diff < 3600) return Math.max(1, Math.round(diff / 60)) + 'm ago';
  if (diff < 86400) return Math.round(diff / 3600) + 'h ago';
  return Math.round(diff / 86400) + 'd ago';
}

export function NewsPanel({ news }: NewsPanelProps) {
  return (
    <>
      <div className="seclabel reveal" style={{ animationDelay: '0.26s' }}>
        <h2>Market News</h2>
        <span className="meta">{news.length} stories</span>
      </div>
      <div className="panel reveal" style={{ animationDelay: '0.28s' }}>
        {news.length === 0 ? (
          <div className="empty-flat" style={{ height: 120 }}>
            <span className="empty-msg">No recent headlines</span>
          </div>
        ) : (
          <div className="news-list">
            {news.map((n, i) => (
              <a
                className="news-item"
                key={`${n.url ?? n.headline}-${i}`}
                href={n.url ?? '#'}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="news-chip">
                  <i style={{ background: TICKER_COLORS[n.symbol as keyof typeof TICKER_COLORS] ?? 'var(--muted)' }} />
                  {n.symbol}
                </span>
                <span className="news-headline">{n.headline}</span>
                <span className="news-meta">
                  {n.source}
                  {n.source && n.datetime ? ' · ' : ''}
                  {relTime(n.datetime)}
                </span>
              </a>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
