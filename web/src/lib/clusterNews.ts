import { NewsArticle, GroupedNews } from '@/types';

function cleanTitle(title: string): string {
  let t = title.replace(/\[[^\]]*\]/g, ' ');
  t = t.replace(/\([^\)]*\)/g, ' ');
  t = t.replace(/['"‘’“”\…·,!?~]/g, ' ');
  return t.replace(/\s+/g, ' ').trim();
}

function calculateSimilarity(t1: string, t2: string): number {
  const c1 = cleanTitle(t1);
  const c2 = cleanTitle(t2);

  const words1 = new Set(c1.split(' ').filter((w) => w.length > 1));
  const words2 = new Set(c2.split(' ').filter((w) => w.length > 1));

  if (words1.size === 0 || words2.size === 0) return 0;

  let intersection = 0;
  for (const w of words1) {
    if (words2.has(w)) intersection++;
  }

  const union = new Set([...words1, ...words2]).size;
  const jaccard = union > 0 ? intersection / union : 0;

  // Substring check for major events (e.g. '숏트립', '사이다 특가', '진마켓')
  let keywordBonus = 0;
  for (const w of words1) {
    if (w.length >= 3 && c2.includes(w)) {
      keywordBonus += 0.15;
    }
  }

  return Math.min(1.0, jaccard + keywordBonus);
}

export function clusterNewsArticles(articles: NewsArticle[]): GroupedNews[] {
  const groups: {
    main: NewsArticle;
    related: NewsArticle[];
    sources: Set<string>;
    japanCities: Set<string>;
    isJapan: boolean;
  }[] = [];

  for (const article of articles) {
    let matchedGroup: (typeof groups)[0] | null = null;

    for (const g of groups) {
      const sim = calculateSimilarity(g.main.title, article.title);

      // Same airline and moderate similarity, or high similarity regardless of airline
      const sameAirline =
        article.airline !== '기타/LCC' &&
        g.main.airline !== '기타/LCC' &&
        article.airline === g.main.airline;

      if (sim >= 0.45 || (sameAirline && sim >= 0.3)) {
        matchedGroup = g;
        break;
      }
    }

    if (matchedGroup) {
      matchedGroup.related.push(article);
      matchedGroup.sources.add(article.source);
      if (article.is_japan === 1) matchedGroup.isJapan = true;
      if (article.japan_cities) {
        article.japan_cities.split(',').forEach((c) => matchedGroup?.japanCities.add(c.trim()));
      }
    } else {
      const citySet = new Set<string>();
      if (article.japan_cities) {
        article.japan_cities.split(',').forEach((c) => citySet.add(c.trim()));
      }

      groups.push({
        main: article,
        related: [],
        sources: new Set([article.source]),
        japanCities: citySet,
        isJapan: article.is_japan === 1,
      });
    }
  }

  return groups.map((g, idx) => {
    // Sort related by publication date
    g.related.sort((a, b) => (b.published_at || '').localeCompare(a.published_at || ''));

    const allCities = Array.from(g.japanCities).filter(Boolean);

    const allArticles = [g.main, ...g.related];

    // Find the best promo_end among all articles in cluster
    const articleWithEnd = allArticles.find((a) => a.promo_end);
    const promoEnd = articleWithEnd?.promo_end || g.main.promo_end || null;

    // Find the most descriptive promo_period_desc
    const articleWithPeriodDesc = allArticles.find(
      (a) => a.promo_period_desc && a.promo_period_desc !== '실시간 진행중'
    );
    const promoPeriodDesc =
      articleWithPeriodDesc?.promo_period_desc || g.main.promo_period_desc || '실시간 진행중';

    // Best promo status: if any article is marked ACTIVE, prefer ACTIVE
    const hasActiveArticle = allArticles.some((a) => a.promo_status === 'ACTIVE');
    const promoStatus = hasActiveArticle ? 'ACTIVE' : g.main.promo_status || 'ACTIVE';

    return {
      id: `group_${g.main.id}_${idx}`,
      mainArticle: g.main,
      relatedArticles: g.related,
      articleCount: 1 + g.related.length,
      sources: Array.from(g.sources),
      is_japan: g.isJapan ? 1 : 0,
      japan_cities: allCities.join(', '),
      airline: g.main.airline,
      promo_status: promoStatus,
      promo_period_desc: promoPeriodDesc,
      promo_end: promoEnd,
      latestPublishedAt: g.main.published_at,
    };
  });
}
