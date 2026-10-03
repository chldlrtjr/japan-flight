import path from 'node:path';
import fs from 'node:fs';
import { Promotion, CrawlStats, NewsArticle } from '@/types';

const DB_PATH = path.resolve(process.cwd(), '..', 'data', 'promotions.db');

function findJsonFile(filename: string): string | null {
  const candidates = [
    path.resolve(process.cwd(), '..', 'data', filename),
    path.resolve(process.cwd(), 'public', 'data', filename),
    path.resolve(process.cwd(), 'data', filename),
  ];
  for (const p of candidates) {
    if (fs.existsSync(p)) return p;
  }
  return null;
}

function loadJsonFallback<T>(filename: string): T[] {
  const filePath = findJsonFile(filename);
  if (!filePath) return [];
  try {
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch (e) {
    console.error(`Failed to load fallback JSON ${filename}:`, e);
    return [];
  }
}

export function getDb(): any {
  try {
    // Dynamic import to avoid crash on environments without node:sqlite
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require('node:sqlite');
    if (!fs.existsSync(DB_PATH)) {
      const dataDir = path.dirname(DB_PATH);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    }
    return new DatabaseSync(DB_PATH);
  } catch (err) {
    console.warn('[DB] SQLite DatabaseSync not available, falling back to JSON mode:', err);
    return null;
  }
}

export function queryPromotions(params: {
  airline?: string;
  region?: string;
  status?: string;
  search?: string;
  sort?: string;
}): { promotions: Promotion[]; stats: CrawlStats } {
  const db = getDb();

  // If SQLite is available, query using SQLite
  if (db) {
    try {
      let query = 'SELECT * FROM promotions WHERE 1=1';
      const queryParams: any[] = [];

      if (params.airline && params.airline !== 'ALL') {
        if (params.airline === 'JAPAN_ALL') {
          const jpCodes = ['JAL', 'ANA', 'PEACH', 'ZIPAIR'];
          query += ` AND (airline_code IN (${jpCodes.map(() => '?').join(',')}) OR airline LIKE '%일본항공%' OR airline LIKE '%전일본공수%' OR airline LIKE '%피치%' OR airline LIKE '%집에어%')`;
          queryParams.push(...jpCodes);
        } else if (params.airline === 'KOREA_ALL') {
          const krCodes = ['KAL', 'AAR', 'JEJU', 'JIN', 'TWAY', 'EASTAR', 'AIR_SEOUL', 'AIR_BUSAN', 'AIR_PREMIA', 'AERO_K', 'PARATA'];
          query += ` AND (airline_code IN (${krCodes.map(() => '?').join(',')}) OR airline LIKE '%대한항공%' OR airline LIKE '%아시아나%' OR airline LIKE '%제주항공%' OR airline LIKE '%진에어%' OR airline LIKE '%티웨이%' OR airline LIKE '%이스타%' OR airline LIKE '%에어서울%' OR airline LIKE '%에어부산%' OR airline LIKE '%에어프레미아%' OR airline LIKE '%에어로케이%' OR airline LIKE '%파라타%')`;
          queryParams.push(...krCodes);
        } else {
          query += ' AND (airline_code = ? OR airline = ? OR airline LIKE ?)';
          queryParams.push(params.airline, params.airline, `%${params.airline}%`);
        }
      }

      if (params.region && params.region !== 'ALL') {
        if (params.region === '소도시') {
          query += " AND (destinations LIKE '%마쓰야마%' OR destinations LIKE '%가고시마%' OR destinations LIKE '%시즈오카%' OR destinations LIKE '%히로시마%' OR destinations LIKE '%다카마쓰%' OR destinations LIKE '%기타큐슈%' OR destinations LIKE '%도쿠시마%' OR title LIKE '%소도시%')";
        } else if (params.region === '나고야') {
          query += " AND (destinations LIKE '%나고야%' OR destinations LIKE '%주부%' OR title LIKE '%나고야%' OR title LIKE '%주부%' OR subtitle LIKE '%나고야%' OR subtitle LIKE '%주부%')";
        } else {
          const term = `%${params.region}%`;
          query += ' AND (destinations LIKE ? OR title LIKE ? OR subtitle LIKE ?)';
          queryParams.push(term, term, term);
        }
      }

      const todayStr = new Date().toISOString().slice(0, 10);
      if (params.status === 'ING') {
        query += ` AND status = 'ING' AND (promo_end IS NULL OR promo_end >= '${todayStr}')`;
      } else if (params.status === 'END') {
        query += ` AND (status = 'END' OR (promo_end IS NOT NULL AND promo_end < '${todayStr}'))`;
      }

      if (params.search && params.search.trim() !== '') {
        const term = `%${params.search.trim()}%`;
        query += ' AND (title LIKE ? OR destinations LIKE ? OR subtitle LIKE ? OR airline LIKE ?)';
        queryParams.push(term, term, term, term);
      }

      // Sorting
      if (params.sort === 'end_soon') {
        query += ` ORDER BY CASE WHEN status = 'ING' AND (promo_end IS NULL OR promo_end >= '${todayStr}') THEN 0 ELSE 1 END, promo_end ASC NULLS LAST, created_at DESC`;
      } else if (params.sort === 'start_recent') {
        query += ' ORDER BY promo_start DESC NULLS LAST, created_at DESC';
      } else {
        query += ` ORDER BY is_featured DESC, CASE WHEN status = 'ING' AND (promo_end IS NULL OR promo_end >= '${todayStr}') THEN 0 ELSE 1 END, created_at DESC`;
      }

      const stmt = db.prepare(query);
      const rows = stmt.all(...queryParams) as unknown as Promotion[];

      // Get overall stats
      const allRowsStmt = db.prepare('SELECT airline, airline_code, region_category, status, is_international, updated_at FROM promotions');
      const allRows = allRowsStmt.all() as any[];

      let activeCount = 0;
      let internationalCount = 0;
      const airlineCounts: Record<string, number> = {};
      const regionCounts: Record<string, number> = {};
      let lastUpdated = '';

      for (const r of allRows) {
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
        promotions: rows,
        stats: {
          total: allRows.length,
          activeCount,
          internationalCount,
          airlineCounts,
          regionCounts,
          lastUpdated: lastUpdated || new Date().toISOString(),
        },
      };
    } catch (e) {
      console.error('[DB] SQLite query error, switching to JSON fallback:', e);
    }
  }

  // Fallback to JSON
  const allPromos = loadJsonFallback<Promotion>('promotions.json');
  let filtered = [...allPromos];

  if (params.airline && params.airline !== 'ALL') {
    if (params.airline === 'JAPAN_ALL') {
      const jpCodes = ['JAL', 'ANA', 'PEACH', 'ZIPAIR', 'JETSTAR_JP', 'SKYMARK', 'STARFLYER', 'AIRDO', 'SOLASEED', 'FDA', 'IBEX', 'SPRING_JP', 'JTA', 'RAC', 'TOKI_AIR', 'AMX', 'ORC', 'HAC'];
      filtered = filtered.filter((p) => jpCodes.includes(p.airline_code) || p.airline.includes('일본') || p.airline.includes('전일본') || p.airline.includes('피치'));
    } else if (params.airline === 'KOREA_ALL') {
      const krCodes = ['KAL', 'AAR', 'JEJU', 'JIN', 'TWAY', 'EASTAR', 'AIR_SEOUL', 'AIR_BUSAN', 'AIR_PREMIA', 'AERO_K', 'PARATA'];
      filtered = filtered.filter((p) => krCodes.includes(p.airline_code) || p.airline.includes('항공') || p.airline.includes('에어'));
    } else {
      filtered = filtered.filter((p) => p.airline_code === params.airline || p.airline === params.airline || p.airline.includes(params.airline!));
    }
  }

  if (params.region && params.region !== 'ALL') {
    if (params.region === '소도시') {
      const towns = ['마쓰야마', '가고시마', '시즈오카', '히로시마', '다카마쓰', '기타큐슈', '도쿠시마', '소도시'];
      filtered = filtered.filter((p) => towns.some((t) => (p.destinations || '').includes(t) || p.title.includes(t)));
    } else if (params.region === '나고야') {
      filtered = filtered.filter((p) =>
        (p.destinations || '').includes('나고야') ||
        (p.destinations || '').includes('주부') ||
        p.title.includes('나고야') ||
        p.title.includes('주부') ||
        (p.subtitle || '').includes('나고야') ||
        (p.subtitle || '').includes('주부')
      );
    } else {
      filtered = filtered.filter((p) => (p.destinations || '').includes(params.region!) || p.title.includes(params.region!) || (p.subtitle || '').includes(params.region!));
    }
  }

  if (params.status && params.status !== 'ALL') {
    filtered = filtered.filter((p) => p.status === params.status);
  }

  if (params.search && params.search.trim() !== '') {
    const s = params.search.trim().toLowerCase();
    filtered = filtered.filter((p) =>
      p.title.toLowerCase().includes(s) ||
      (p.destinations || '').toLowerCase().includes(s) ||
      (p.subtitle || '').toLowerCase().includes(s) ||
      p.airline.toLowerCase().includes(s)
    );
  }

  // Sort
  if (params.sort === 'end_soon') {
    filtered.sort((a, b) => (a.status === 'ING' ? 0 : 1) - (b.status === 'ING' ? 0 : 1) || (a.promo_end || '9999').localeCompare(b.promo_end || '9999'));
  } else if (params.sort === 'start_recent') {
    filtered.sort((a, b) => (b.promo_start || '').localeCompare(a.promo_start || ''));
  } else {
    filtered.sort((a, b) => (b.is_featured || 0) - (a.is_featured || 0) || (a.status === 'ING' ? 0 : 1) - (b.status === 'ING' ? 0 : 1) || b.created_at.localeCompare(a.created_at));
  }

  let activeCount = 0;
  let internationalCount = 0;
  const airlineCounts: Record<string, number> = {};
  const regionCounts: Record<string, number> = {};
  let lastUpdated = '';

  for (const r of allPromos) {
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
    promotions: filtered,
    stats: {
      total: allPromos.length,
      activeCount,
      internationalCount,
      airlineCounts,
      regionCounts,
      lastUpdated: lastUpdated || new Date().toISOString(),
    },
  };
}

export function queryNews(params: {
  isJapanOnly?: boolean;
  search?: string;
  airline?: string;
}): { news: NewsArticle[]; totalCount: number; japanCount: number } {
  const db = getDb();
  const todayStr = new Date().toISOString().slice(0, 10);

  if (db) {
    try {
      let query = `SELECT * FROM news_articles WHERE (promo_end IS NULL OR promo_end >= '${todayStr}')`;
      const queryParams: any[] = [];

      if (params.isJapanOnly) {
        query += ' AND is_japan = 1';
      }

      if (params.airline && params.airline !== 'ALL') {
        if (params.airline === 'JAPAN_ALL') {
          query += ` AND (is_japan = 1 OR airline LIKE '%피치%' OR airline LIKE '%일본항공%' OR airline LIKE '%전일본공수%' OR airline LIKE '%집에어%' OR title LIKE '%피치%' OR title LIKE '%JAL%' OR title LIKE '%ANA%' OR title LIKE '%일본항공%' OR title LIKE '%집에어%')`;
        } else if (params.airline === 'KOREA_ALL') {
          query += ` AND (airline LIKE '%대한항공%' OR airline LIKE '%아시아나%' OR airline LIKE '%제주항공%' OR airline LIKE '%진에어%' OR airline LIKE '%티웨이%' OR airline LIKE '%이스타%' OR airline LIKE '%에어서울%' OR airline LIKE '%에어부산%' OR airline LIKE '%에어프레미아%' OR airline LIKE '%에어로케이%' OR airline LIKE '%파라타%' OR title LIKE '%대한항공%' OR title LIKE '%아시아나%' OR title LIKE '%제주항공%' OR title LIKE '%진에어%' OR title LIKE '%티웨이%' OR title LIKE '%이스타%' OR title LIKE '%에어서울%' OR title LIKE '%에어부산%' OR title LIKE '%에어프레미아%' OR title LIKE '%에어로케이%' OR title LIKE '%파라타%')`;
        } else {
          query += ' AND (airline = ? OR title LIKE ?)';
          queryParams.push(params.airline, `%${params.airline}%`);
        }
      }

      if (params.search && params.search.trim() !== '') {
        const term = `%${params.search.trim()}%`;
        query += ' AND (title LIKE ? OR japan_cities LIKE ? OR summary LIKE ? OR source LIKE ?)';
        queryParams.push(term, term, term, term);
      }

      query += ' ORDER BY is_japan DESC, published_at DESC, created_at DESC LIMIT 100';

      const stmt = db.prepare(query);
      const rows = stmt.all(...queryParams) as unknown as NewsArticle[];
      const countRow = db.prepare(`SELECT count(*) as total, sum(is_japan) as japan_cnt FROM news_articles WHERE (promo_end IS NULL OR promo_end >= '${todayStr}')`).get() as any;

      return {
        news: rows,
        totalCount: countRow?.total || 0,
        japanCount: countRow?.japan_cnt || 0,
      };
    } catch (e) {
      console.error('[DB] SQLite news query error, switching to JSON fallback:', e);
    }
  }

  // Fallback to JSON
  const allNews = loadJsonFallback<NewsArticle>('news.json');
  let filtered = allNews.filter((n) => !n.promo_end || n.promo_end >= todayStr);

  if (params.isJapanOnly) {
    filtered = filtered.filter((n) => n.is_japan === 1);
  }

  if (params.airline && params.airline !== 'ALL') {
    if (params.airline === 'JAPAN_ALL') {
      filtered = filtered.filter((n) => n.is_japan === 1 || (n.airline && (n.airline.includes('일본') || n.airline.includes('피치') || n.airline.includes('집에어'))));
    } else if (params.airline === 'KOREA_ALL') {
      filtered = filtered.filter((n) => n.airline && (n.airline.includes('대한항공') || n.airline.includes('아시아나') || n.airline.includes('제주항공') || n.airline.includes('진에어') || n.airline.includes('티웨이') || n.airline.includes('이스타')));
    } else {
      filtered = filtered.filter((n) => n.airline === params.airline || n.title.includes(params.airline!));
    }
  }

  if (params.search && params.search.trim() !== '') {
    const s = params.search.trim().toLowerCase();
    filtered = filtered.filter((n) =>
      n.title.toLowerCase().includes(s) ||
      (n.japan_cities || '').toLowerCase().includes(s) ||
      (n.summary || '').toLowerCase().includes(s) ||
      n.source.toLowerCase().includes(s)
    );
  }

  filtered.sort((a, b) => (b.is_japan || 0) - (a.is_japan || 0) || (b.published_at || '').localeCompare(a.published_at || '') || b.created_at.localeCompare(a.created_at));

  return {
    news: filtered.slice(0, 100),
    totalCount: filtered.length,
    japanCount: filtered.filter((n) => n.is_japan === 1).length,
  };
}
