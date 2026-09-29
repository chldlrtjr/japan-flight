import { Promotion, CrawlStats, NewsArticle } from '@/types';

export function calculatePromoStats(promotions: Promotion[]): CrawlStats {
  let activeCount = 0;
  let internationalCount = 0;
  const airlineCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  let lastUpdated = '';

  for (const r of promotions) {
    if (r.status === 'ING') activeCount++;
    if (r.is_international === 1) internationalCount++;

    airlineCounts[r.airline] = (airlineCounts[r.airline] || 0) + 1;
    if (r.region_category) {
      regionCounts[r.region_category] = (regionCounts[r.region_category] || 0) + 1;
    }
    if (!lastUpdated || (r.updated_at && r.updated_at > lastUpdated)) {
      lastUpdated = r.updated_at;
    }
  }

  return {
    total: promotions.length,
    activeCount,
    internationalCount,
    airlineCounts,
    regionCounts,
    lastUpdated: lastUpdated || new Date().toISOString(),
  };
}

export function filterPromotions(
  allPromos: Promotion[],
  params: {
    airline: string;
    region: string;
    status: string;
    search: string;
    sort: string;
    bookmarkedIds: string[];
    showOnlyBookmarks: boolean;
  }
): Promotion[] {
  let list = [...allPromos];

  // Bookmark filter
  if (params.showOnlyBookmarks) {
    list = list.filter((p) => params.bookmarkedIds.includes(p.id));
  }

  // Airline filter
  if (params.airline && params.airline !== 'ALL') {
    if (params.airline === 'JAPAN_ALL') {
      const jpCodes = ['JAL', 'ANA', 'PEACH', 'ZIPAIR', 'JETSTAR_JP', 'SKYMARK', 'STARFLYER', 'AIRDO', 'SOLASEED', 'FDA', 'IBEX', 'SPRING_JP', 'JTA', 'RAC', 'TOKI_AIR', 'AMX', 'ORC', 'HAC'];
      list = list.filter((p) => jpCodes.includes(p.airline_code) || p.airline.includes('일본') || p.airline.includes('전일본') || p.airline.includes('피치'));
    } else if (params.airline === 'KOREA_ALL') {
      const krCodes = ['KAL', 'AAR', 'JEJU', 'JIN', 'TWAY', 'EASTAR', 'AIR_SEOUL', 'AIR_BUSAN', 'AIR_PREMIA', 'AERO_K', 'PARATA'];
      list = list.filter((p) => krCodes.includes(p.airline_code) || p.airline.includes('대한') || p.airline.includes('아시아나') || p.airline.includes('항공') || p.airline.includes('에어'));
    } else {
      list = list.filter((p) => p.airline_code === params.airline || p.airline === params.airline || p.airline.includes(params.airline));
    }
  }

  // Region filter
  if (params.region && params.region !== 'ALL') {
    if (params.region === '소도시') {
      const towns = ['마쓰야마', '가고시마', '시즈오카', '히로시마', '다카마쓰', '기타큐슈', '도쿠시마', '소도시'];
      list = list.filter((p) => towns.some((t) => (p.destinations || '').includes(t) || p.title.includes(t)));
    } else {
      list = list.filter((p) => (p.destinations || '').includes(params.region) || p.title.includes(params.region) || (p.subtitle || '').includes(params.region));
    }
  }

  // Status filter
  if (params.status && params.status !== 'ALL') {
    list = list.filter((p) => p.status === params.status);
  }

  // Search term
  if (params.search && params.search.trim() !== '') {
    const s = params.search.trim().toLowerCase();
    list = list.filter((p) =>
      p.title.toLowerCase().includes(s) ||
      (p.destinations || '').toLowerCase().includes(s) ||
      (p.subtitle || '').toLowerCase().includes(s) ||
      p.airline.toLowerCase().includes(s)
    );
  }

  // Sorting
  if (params.sort === 'end_soon') {
    list.sort((a, b) => (a.status === 'ING' ? 0 : 1) - (b.status === 'ING' ? 0 : 1) || (a.promo_end || '9999').localeCompare(b.promo_end || '9999'));
  } else if (params.sort === 'start_recent') {
    list.sort((a, b) => (b.promo_start || '').localeCompare(a.promo_start || ''));
  } else {
    list.sort((a, b) => (b.is_featured || 0) - (a.is_featured || 0) || (a.status === 'ING' ? 0 : 1) - (b.status === 'ING' ? 0 : 1) || b.created_at.localeCompare(a.created_at));
  }

  return list;
}

export function filterNewsArticles(
  allNews: NewsArticle[],
  params: {
    isJapanOnly: boolean;
    airline: string;
    search: string;
  }
): NewsArticle[] {
  const todayStr = new Date().toISOString().slice(0, 10);
  let list = allNews.filter((n) => !n.promo_end || n.promo_end >= todayStr);

  if (params.isJapanOnly) {
    list = list.filter((n) => n.is_japan === 1);
  }

  if (params.airline && params.airline !== 'ALL') {
    if (params.airline === 'JAPAN_ALL') {
      list = list.filter((n) => n.is_japan === 1 || (n.airline && (n.airline.includes('일본') || n.airline.includes('피치') || n.airline.includes('집에어'))));
    } else if (params.airline === 'KOREA_ALL') {
      list = list.filter((n) => n.airline && (n.airline.includes('대한항공') || n.airline.includes('아시아나') || n.airline.includes('제주항공') || n.airline.includes('진에어') || n.airline.includes('티웨이') || n.airline.includes('이스타')));
    } else {
      list = list.filter((n) => n.airline === params.airline || n.title.includes(params.airline));
    }
  }

  if (params.search && params.search.trim() !== '') {
    const s = params.search.trim().toLowerCase();
    list = list.filter((n) =>
      n.title.toLowerCase().includes(s) ||
      (n.japan_cities || '').toLowerCase().includes(s) ||
      (n.summary || '').toLowerCase().includes(s) ||
      n.source.toLowerCase().includes(s)
    );
  }

  list.sort((a, b) => (b.is_japan || 0) - (a.is_japan || 0) || (b.published_at || '').localeCompare(a.published_at || '') || b.created_at.localeCompare(a.created_at));

  return list;
}
