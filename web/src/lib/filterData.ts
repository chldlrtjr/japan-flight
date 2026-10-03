import { Promotion, CrawlStats, NewsArticle } from '@/types';

export function calculatePromoStats(promotions: Promotion[]): CrawlStats {
  const japanPromos = promotions.filter(isStrictJapanPromo);
  let activeCount = 0;
  let internationalCount = 0;
  const airlineCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  let lastUpdated = '';

  for (const r of japanPromos) {
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
    total: japanPromos.length,
    activeCount,
    internationalCount,
    airlineCounts,
    regionCounts,
    lastUpdated: lastUpdated || new Date().toISOString(),
  };
}

export const CITY_KEYWORDS: Record<string, string[]> = {
  도쿄: ['도쿄', '나리타', '하네다', 'Tokyo', 'NRT', 'HND'],
  오사카: ['오사카', '간사이', 'Osaka', 'KIX'],
  후쿠오카: ['후쿠오카', 'Fukuoka', 'FUK'],
  삿포로: ['삿포로', '신치토세', '치토세', '홋카이도', 'Sapporo', 'CTS'],
  나고야: ['나고야', '주부', '센트레아', 'Nagoya', 'NGO'],
  오키나와: ['오키나와', '나하', 'Okinawa', 'OKA'],
  마쓰야마: ['마쓰야마', 'Matsuyama', 'MYJ'],
  다카마쓰: ['다카마쓰', '타카마츠', 'Takamatsu', 'TAK'],
  히로시마: ['히로시마', 'Hiroshima', 'HIJ'],
  시즈오카: ['시즈오카', '후지산', 'Shizuoka', 'FSZ'],
  기타큐슈: ['기타큐슈', '키타큐슈', 'Kitakyushu', 'KKJ'],
  구마모토: ['구마모토', '쿠마모토', 'Kumamoto', 'KMJ'],
  가고시마: ['가고시마', 'Kagoshima', 'KOJ'],
  오이타: ['오이타', 'Oita', 'OIT'],
  사가: ['사가', 'Saga', 'HSG'],
  나가사키: ['나가사키', 'Nagasaki', 'NGS'],
  미야자키: ['미야자키', 'Miyazaki', 'KMI'],
  요나고: ['요나고', '돗토리', 'Yonago', 'YGJ'],
  오카야마: ['오카야마', 'Okayama', 'OKJ'],
  고마쓰: ['고마쓰', '고마츠', '가나자와', 'Komatsu', 'KMQ'],
  센다이: ['센다이', 'Sendai', 'SDJ'],
  아오모리: ['아오모리', 'Aomori', 'AOJ'],
  니가타: ['니가타', 'Niigata', 'KIJ'],
  도쿠시마: ['도쿠시마', 'Tokushima', 'TKS'],
  아사히카와: ['아사히카와', 'Asahikawa', 'AKJ'],
  하코다테: ['하코다테', 'Hakodate', 'HKD'],
  도야마: ['도야마', '토야마', 'Toyama', 'TOY'],
  고베: ['고베', 'Kobe', 'UKB'],
  미야코지마: ['미야코지마', '시모지지마', 'Miyakojima', 'SHI', 'MMY'],
  우베: ['우베', '야마구치', 'Ube', 'UBJ'],
  이바라키: ['이바라키', 'Ibaraki', 'IBR'],
};

const NON_JAPAN_DESTINATIONS = [
  '괌', '사이판', '홍콩', '마카오', '타이베이', '가오슝', '대만',
  '다낭', '나트랑', '푸꾸옥', '하노이', '호치민', '방콕', '치앙마이',
  '푸켓', '싱가포르', '코타키나발루', '보라카이', '세부', '발리',
  '하와이', '유럽', '미주'
];

export function isStrictJapanPromo(promo: Promotion): boolean {
  const title = promo.title || '';
  const subtitle = promo.subtitle || '';
  const dests = promo.destinations || '';
  const fullText = `${title} ${subtitle} ${dests}`.toLowerCase();

  // 1. Strictly reject pure non-Japan destinations (e.g. Guam, Hong Kong, Singapore)
  for (const nonJp of NON_JAPAN_DESTINATIONS) {
    if (title.includes(nonJp)) {
      const hasJpCityInTitle = Object.values(CITY_KEYWORDS).some((kws) =>
        kws.some((kw) => title.toLowerCase().includes(kw.toLowerCase()))
      ) || title.includes('일본');
      if (!hasJpCityInTitle) return false;
    }
  }

  // 2. Reject if destinations is purely non-Japan
  if (dests === '괌' || dests.includes('괌,') || dests.includes('홍콩') || dests.includes('다낭')) {
    const hasJpCityInDest = Object.values(CITY_KEYWORDS).some((kws) =>
      kws.some((kw) => dests.toLowerCase().includes(kw.toLowerCase()))
    );
    if (!hasJpCityInDest) return false;
  }

  // 3. Strictly reject pure Japanese domestic-only airlines and routes
  const JAPAN_DOMESTIC_AIRLINES = [
    '스카이마크', '스타플라이어', '에어도', '솔라시드', '후지드림',
    '아이벡스', '토키에어', '아마쿠사', '오리엔탈 에어', '오리엔탈에어',
    '홋카이도 에어', '류큐 에어', '일본 트랜스오션', '제트스타 재팬', '스프링 재팬'
  ];
  if (JAPAN_DOMESTIC_AIRLINES.some((da) => promo.airline.includes(da))) {
    return false;
  }
  if (
    promo.airline_code &&
    ['SKYMARK', 'STARFLYER', 'AIRDO', 'SOLASEED', 'FDA', 'IBEX', 'SPRING_JP', 'JETSTAR_JP', 'JTA', 'RAC', 'TOKI_AIR', 'AMX', 'ORC', 'HAC'].includes(promo.airline_code)
  ) {
    return false;
  }

  // 4. Must be relevant to Japan (Japan city, Japan airline, or explicitly '일본')
  const hasJapanCity = Object.values(CITY_KEYWORDS).some((kws) =>
    kws.some((kw) => fullText.includes(kw.toLowerCase()))
  );
  const hasJapanAirlineOrWord =
    fullText.includes('일본') ||
    promo.airline.includes('일본항공') ||
    promo.airline.includes('전일본공수') ||
    promo.airline.includes('JAL') ||
    promo.airline.includes('ANA') ||
    promo.airline.includes('피치') ||
    promo.airline.includes('Peach') ||
    promo.airline.includes('집에어') ||
    promo.airline.includes('ZIPAIR');

  if (!hasJapanCity && !hasJapanAirlineOrWord) {
    return false;
  }

  // 5. Reject generic promotions (e.g. points, museum, general credit cards)
  const genericExclude = ['포인트 적립', '국립항공박물관', '신한카드', '액티브 시니어', '우리 동네', '체크인 혜택'];
  if (genericExclude.some((w) => title.includes(w)) && !hasJapanCity) {
    return false;
  }

  return true;
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
  // 100% Strict Japan Only: filter out any Guam, SE Asia, HK or unrelated events, and exclude domestic routes
  let list = allPromos.filter(isStrictJapanPromo);

  // Clean destinations to remove non-Japan cities if mixed (e.g. "다낭, 괌, 나트랑")
  list = list.map((p) => {
    if (p.destinations && NON_JAPAN_DESTINATIONS.some((non) => p.destinations.includes(non))) {
      const cleanedDests = p.destinations
        .split(',')
        .map((d) => d.trim())
        .filter((d) => !NON_JAPAN_DESTINATIONS.includes(d))
        .join(', ');
      return { ...p, destinations: cleanedDests };
    }
    return p;
  });

  // Bookmark filter
  if (params.showOnlyBookmarks) {
    list = list.filter((p) => params.bookmarkedIds.includes(p.id));
  }

  // Airline filter
  if (params.airline && params.airline !== 'ALL') {
    if (params.airline === 'JAPAN_ALL') {
      const jpCodes = ['JAL', 'ANA', 'PEACH', 'ZIPAIR'];
      list = list.filter((p) => jpCodes.includes(p.airline_code) || p.airline.includes('일본항공') || p.airline.includes('전일본공수') || p.airline.includes('피치') || p.airline.includes('집에어'));
    } else if (params.airline === 'KOREA_ALL') {
      const krCodes = ['KAL', 'AAR', 'JEJU', 'JIN', 'TWAY', 'EASTAR', 'AIR_SEOUL', 'AIR_BUSAN', 'AIR_PREMIA', 'AERO_K', 'PARATA'];
      list = list.filter((p) => krCodes.includes(p.airline_code) || p.airline.includes('대한') || p.airline.includes('아시아나') || p.airline.includes('항공') || p.airline.includes('에어'));
    } else {
      list = list.filter((p) => p.airline_code === params.airline || p.airline === params.airline || p.airline.includes(params.airline));
    }
  }

  // Region / City filter
  if (params.region && params.region !== 'ALL') {
    const keywords = CITY_KEYWORDS[params.region] || [params.region];
    list = list.filter((p) => {
      const targetStr = `${p.destinations || ''} ${p.title || ''} ${p.subtitle || ''}`.toLowerCase();
      return keywords.some((kw) => targetStr.includes(kw.toLowerCase()));
    });
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
