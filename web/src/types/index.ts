export interface Promotion {
  id: string;
  airline: string;
  airline_code: 'JEJU' | 'TWAY' | 'EASTAR' | 'JIN' | string;
  title: string;
  subtitle: string;
  badge_text: string;
  detail_url: string;
  image_url: string;
  promo_start: string | null;
  promo_end: string | null;
  travel_period: string;
  is_international: number;
  region_category: string;
  destinations: string;
  status: 'ING' | 'UPCOMING' | 'END';
  is_featured: number;
  view_count: number;
  created_at: string;
  updated_at: string;
}

export interface CrawlStats {
  total: number;
  activeCount: number;
  internationalCount: number;
  airlineCounts: Record<string, number>;
  regionCounts: Record<string, number>;
  lastUpdated: string;
}

export interface NewsArticle {
  id: string;
  title: string;
  summary: string;
  source: string;
  link: string;
  published_at: string | null;
  airline: string;
  is_japan: number;
  japan_cities: string;
  region_category: string;
  promo_status?: 'ACTIVE' | 'UPCOMING' | string;
  promo_period_desc?: string;
  promo_end?: string | null;
  created_at: string;
}

export interface GroupedNews {
  id: string;
  mainArticle: NewsArticle;
  relatedArticles: NewsArticle[];
  articleCount: number;
  sources: string[];
  is_japan: number;
  japan_cities: string;
  airline: string;
  promo_status?: 'ACTIVE' | 'UPCOMING' | string;
  promo_period_desc?: string;
  promo_end?: string | null;
  latestPublishedAt: string | null;
}
