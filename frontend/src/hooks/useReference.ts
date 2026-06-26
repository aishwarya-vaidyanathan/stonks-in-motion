import { useEffect, useState } from 'react';
import { getMetrics, getNews, getProfiles, getRecommendations } from '../api';
import type { CompanyProfile, NewsItem, Recommendation, SymbolMetrics } from '../types';

interface UseReferenceReturn {
  profiles: Record<string, CompanyProfile>;
  metrics: Record<string, SymbolMetrics>;
  recommendations: Record<string, Recommendation>;
  news: NewsItem[];
}

const METRICS_REFRESH_MS = 30 * 60 * 1000; // 30m
const NEWS_REFRESH_MS = 5 * 60 * 1000; // 5m

/**
 * Slow-changing reference data from the backend's cached Finnhub endpoints.
 * Profiles load once; metrics/recommendations refresh every 30m; news every 5m.
 * Failures are swallowed (the panels just render empty/skeleton state).
 */
export function useReference(): UseReferenceReturn {
  const [profiles, setProfiles] = useState<Record<string, CompanyProfile>>({});
  const [metrics, setMetrics] = useState<Record<string, SymbolMetrics>>({});
  const [recommendations, setRecommendations] = useState<Record<string, Recommendation>>({});
  const [news, setNews] = useState<NewsItem[]>([]);

  // Profiles: once on mount.
  useEffect(() => {
    getProfiles().then(setProfiles).catch(() => {});
  }, []);

  // Metrics + recommendations: mount + periodic.
  useEffect(() => {
    const load = () => {
      getMetrics().then(setMetrics).catch(() => {});
      getRecommendations().then(setRecommendations).catch(() => {});
    };
    load();
    const id = setInterval(load, METRICS_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  // News: mount + periodic.
  useEffect(() => {
    const load = () => getNews(30).then(setNews).catch(() => {});
    load();
    const id = setInterval(load, NEWS_REFRESH_MS);
    return () => clearInterval(id);
  }, []);

  return { profiles, metrics, recommendations, news };
}
