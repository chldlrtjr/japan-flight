import os
import sys
import json
import sqlite3
import re
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

# Add root folder to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


KST = timezone(timedelta(hours=9))

def now_kst_iso() -> str:
    """Returns ISO format timestamp with KST (+09:00) timezone offset."""
    return datetime.now(KST).isoformat()

def today_kst_str() -> str:
    """Returns today's date string in KST (YYYY-MM-DD)."""
    return datetime.now(KST).strftime("%Y-%m-%d")

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DB_DIR, "promotions.db")

# Zero-Guesswork Blacklisted fake IDs and domestic-only carriers
BLACKLIST_MOCK_PROMO_IDS = {
    'csair_akl_guangzhou_transit_deal', 'koreanair_akl_direct_2026', 'airnz_nz_all_deals_2026',
    'airpremia_sapporo_inauguration', 'airbusan_october_coupon', 'airseoul_october_hurry',
    'airseoul_takamatsu_10th', 'jin_october_newmember_baggage', 'jin_guam_superlow',
    'parata_japan_paranweek', 'peach_autumn_sale', 'airseoul_yonago_takamatsu',
    'airbusan_fukuoka_winter', 'jin_jinmarket_autumn', 'jin_japan_special',
    'jin_sapporo_okinawa_sale', 'zipair_narita_special', 'kal_japan_app_special',
    'asiana_japan_season_deal', 'jal_haneda_earlybird', 'ana_gimpo_sale',
    'skymark_imatoku_deal', 'starflyer_star_early', 'airdo_do_bargain',
    'solaseed_bargain_series', 'fda_dream_early', 'ibex_tokuwari',
    'jta_okinawa_island_special', 'rac_island_connect', 'tokiair_niigata_sapporo',
    'amx_mizoka_deal', 'orc_nagasaki_tsushima', 'hac_hokkaido_okadama',
    'spring_japan_tokyo_hiroshima', 'jetstar_super_star_sale'
}

JAPAN_DOMESTIC_AIRLINE_CODES = {
    'SKYMARK', 'STARFLYER', 'AIRDO', 'SOLASEED', 'FDA', 'IBEX', 
    'SPRING_JP', 'JETSTAR_JP', 'JTA', 'RAC', 'TOKI_AIR', 'AMX', 'ORC', 'HAC'
}

JAPAN_DOMESTIC_AIRLINE_NAMES = [
    '스카이마크', '스타플라이어', '에어도', '솔라시드', '후지드림',
    '아이벡스', '토키에어', '토키', '아마쿠사', '오리엔탈', '홋카이도 에어',
    '류큐', '트랜스오션', '제트스타 재팬', '스프링 재팬'
]

IRRELEVANT_KEYWORDS = [
    '홍콩', '싱가포르', '국립항공박물관', '포인트 적립', '신한카드',
    '시니어', '우리 동네', '체크인 혜택', '면세점', '박물관'
]

def get_connection() -> sqlite3.Connection:
    os.makedirs(DB_DIR, exist_ok=True)
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_connection()
    cursor = conn.cursor()
    
    # Create promotions table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS promotions (
            id TEXT PRIMARY KEY,
            airline TEXT NOT NULL,
            airline_code TEXT NOT NULL,
            title TEXT NOT NULL,
            subtitle TEXT,
            badge_text TEXT,
            detail_url TEXT NOT NULL,
            image_url TEXT,
            promo_start TEXT,
            promo_end TEXT,
            travel_period TEXT,
            is_international INTEGER DEFAULT 1,
            region_category TEXT,
            destinations TEXT,
            status TEXT DEFAULT 'ING',
            is_featured INTEGER DEFAULT 0,
            view_count INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ''')

    # Create crawl logs table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS crawl_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            airline TEXT NOT NULL,
            status TEXT NOT NULL,
            items_found INTEGER DEFAULT 0,
            items_saved INTEGER DEFAULT 0,
            error_message TEXT,
            started_at TEXT NOT NULL,
            finished_at TEXT NOT NULL
        )
    ''')

    # Create news articles table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS news_articles (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            summary TEXT,
            source TEXT NOT NULL,
            link TEXT NOT NULL UNIQUE,
            published_at TEXT,
            airline TEXT,
            is_japan INTEGER DEFAULT 0,
            japan_cities TEXT,
            region_category TEXT,
            promo_status TEXT DEFAULT 'ACTIVE',
            promo_period_desc TEXT,
            promo_end TEXT,
            created_at TEXT NOT NULL
        )
    ''')

    # Create sent_notifications table
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS sent_notifications (
            id TEXT PRIMARY KEY,
            airline TEXT,
            title TEXT,
            detail_url TEXT,
            sent_at TEXT NOT NULL
        )
    ''')

    # Seed existing promotions into sent_notifications
    cursor.execute('''
        INSERT OR IGNORE INTO sent_notifications (id, airline, title, detail_url, sent_at)
        SELECT id, airline, title, detail_url, created_at FROM promotions
    ''')

    # Migration: add columns if table already exists
    for col, col_type in [
        ("promo_status", "TEXT DEFAULT 'ACTIVE'"),
        ("promo_period_desc", "TEXT"),
        ("promo_end", "TEXT")
    ]:
        try:
            cursor.execute(f"ALTER TABLE news_articles ADD COLUMN {col} {col_type}")
        except Exception:
            pass

    # Purge blacklisted mock IDs and domestic airlines
    placeholders = ','.join('?' for _ in BLACKLIST_MOCK_PROMO_IDS)
    cursor.execute(f"DELETE FROM promotions WHERE id IN ({placeholders})", tuple(BLACKLIST_MOCK_PROMO_IDS))

    code_placeholders = ','.join('?' for _ in JAPAN_DOMESTIC_AIRLINE_CODES)
    cursor.execute(f"DELETE FROM promotions WHERE airline_code IN ({code_placeholders})", tuple(JAPAN_DOMESTIC_AIRLINE_CODES))

    for da in JAPAN_DOMESTIC_AIRLINE_NAMES:
        cursor.execute("DELETE FROM promotions WHERE airline LIKE ?", (f'%{da}%',))

    for ik in IRRELEVANT_KEYWORDS:
        cursor.execute("DELETE FROM promotions WHERE title LIKE ? OR subtitle LIKE ?", (f'%{ik}%', f'%{ik}%'))

    cursor.execute("""
        DELETE FROM promotions
        WHERE image_url LIKE '%unsplash.com%'
           OR detail_url LIKE '%csair.com/kr/ko%'
           OR detail_url LIKE '%/promotionList%'
           OR detail_url LIKE '%flights-from-seoul-to-auckland%'
           OR detail_url LIKE '%flight-deals-to-new-zealand%'
           OR airline LIKE '%파라타%'
           OR airline_code = 'PARATA'
    """)

    cursor.execute("""
        DELETE FROM promotions
        WHERE (destinations IS NULL OR destinations = '')
          AND title NOT LIKE '%일본%'
          AND title NOT LIKE '%뉴질랜드%'
          AND title NOT LIKE '%오클랜드%'
          AND title NOT LIKE '%크라이스트처치%'
          AND title NOT LIKE '%퀸스타운%'
          AND title NOT LIKE '%웰링턴%'
    """)

    # Normalize legacy rows where region_category held a city name (e.g. '센다이', '오클랜드')
    cursor.execute("""
        UPDATE promotions SET region_category = '일본'
        WHERE region_category IS NULL OR region_category NOT IN ('일본', '뉴질랜드')
    """)
    for kw in ('뉴질랜드', '오클랜드', '크라이스트처치', '퀸스타운', '웰링턴', 'Auckland', 'New Zealand'):
        cursor.execute(
            "UPDATE promotions SET region_category = '뉴질랜드' WHERE title LIKE ? OR subtitle LIKE ? OR destinations LIKE ?",
            (f'%{kw}%', f'%{kw}%', f'%{kw}%')
        )

    # Permanently delete any expired promotions or news
    today_str = today_kst_str()
    cursor.execute("DELETE FROM promotions WHERE status = 'END' OR (promo_end IS NOT NULL AND promo_end < ?)", (today_str,))
    cursor.execute("DELETE FROM news_articles WHERE promo_status = 'END' OR (promo_end IS NOT NULL AND promo_end < ?)", (today_str,))

    conn.commit()
    conn.close()

    clean_invalid_news()

def clean_invalid_news() -> int:
    """Examines all news articles in the database and permanently deletes invalid/expired ones."""
    from crawler.news import is_valid_active_promo
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT id, title, summary, published_at, link FROM news_articles")
    rows = cursor.fetchall()

    today = datetime.now()
    cutoff_date = (today - timedelta(days=14)).strftime("%Y-%m-%d")

    delete_ids = []
    for r in rows:
        title = r['title']
        summary = r['summary'] or ''
        pub_at = r['published_at'] or ''
        link = r['link'] or ''

        # URL date check
        m_url = re.search(r'(202[4-9])[/-]?([01]\d)[/-]?([0-3]\d)', link)
        if m_url:
            y, mo, da = m_url.groups()
            actual_url_date = f"{int(y):04d}-{int(mo):02d}-{int(da):02d}"
            if actual_url_date < cutoff_date:
                delete_ids.append(r['id'])
                continue

        # Strict active promo check
        if not is_valid_active_promo(title, summary, pub_at):
            delete_ids.append(r['id'])
            continue

        # Direct cutoff date check
        if pub_at < cutoff_date:
            delete_ids.append(r['id'])
            continue

    if delete_ids:
        cursor.executemany("DELETE FROM news_articles WHERE id = ?", [(did,) for did in delete_ids])
        conn.commit()
        print(f"[DB] Purged {len(delete_ids)} invalid/irrelevant news articles from database.")

    conn.close()
    return len(delete_ids)

def upsert_news(news: Dict[str, Any]) -> bool:
    from crawler.news import is_valid_active_promo
    if not is_valid_active_promo(
        news.get("title", ""),
        news.get("summary", ""),
        news.get("published_at", "") or ""
    ):
        return False

    if news.get("is_japan", 0) != 1 and news.get("region_category") != "뉴질랜드":
        return False

    today_str = today_kst_str()
    if news.get("promo_status") == "END":
        return False
    if news.get("promo_end") and news["promo_end"] < today_str:
        return False

    conn = get_connection()
    cursor = conn.cursor()
    now = now_kst_iso()
    
    cursor.execute('''
        INSERT INTO news_articles (
            id, title, summary, source, link, published_at,
            airline, is_japan, japan_cities, region_category, promo_status, promo_period_desc, promo_end, created_at
        ) VALUES (
            :id, :title, :summary, :source, :link, :published_at,
            :airline, :is_japan, :japan_cities, :region_category, :promo_status, :promo_period_desc, :promo_end, :created_at
        )
        ON CONFLICT(link) DO UPDATE SET
            title=excluded.title,
            summary=excluded.summary,
            source=excluded.source,
            published_at=COALESCE(excluded.published_at, news_articles.published_at),
            airline=COALESCE(excluded.airline, news_articles.airline),
            is_japan=excluded.is_japan,
            japan_cities=excluded.japan_cities,
            region_category=excluded.region_category,
            promo_status=excluded.promo_status,
            promo_period_desc=excluded.promo_period_desc,
            promo_end=excluded.promo_end
    ''', {
        "id": news["id"],
        "title": news["title"],
        "summary": news.get("summary", ""),
        "source": news.get("source", "언론사"),
        "link": news["link"],
        "published_at": news.get("published_at"),
        "airline": news.get("airline", "전체"),
        "is_japan": news.get("is_japan", 0),
        "japan_cities": news.get("japan_cities", "뉴질랜드" if news.get("region_category") == "뉴질랜드" else "일본"),
        "region_category": news.get("region_category", "일본"),
        "promo_status": news.get("promo_status", "ACTIVE"),
        "promo_period_desc": news.get("promo_period_desc", "실시간 진행중"),
        "promo_end": news.get("promo_end"),
        "created_at": now
    })
    
    conn.commit()
    conn.close()
    return True

def upsert_promotion(promo: Dict[str, Any]) -> bool:
    from crawler.url_verifier import is_root_or_generic_url, is_fake_or_stock_image

    # Zero-Guesswork Rule: Reject fake stock images (Unsplash)
    if is_fake_or_stock_image(promo.get('image_url')):
        return False

    # Zero-Guesswork Rule: Reject airline homepage root or generic list URLs
    is_generic, _ = is_root_or_generic_url(promo.get('detail_url', ''))
    if is_generic:
        return False

    # Zero-Guesswork Rule: Reject blacklisted fake IDs
    if promo.get('id') in BLACKLIST_MOCK_PROMO_IDS:
        return False

    # Strictly reject expired promotions
    today_str = today_kst_str()
    if promo.get("status") == "END":
        return False
    if promo.get("promo_end") and promo["promo_end"] < today_str:
        return False

    title = promo.get('title', '')
    dests = promo.get('destinations', '')
    airline = promo.get('airline', '')
    airline_code = promo.get('airline_code', '')

    if any(k in title for k in IRRELEVANT_KEYWORDS):
        return False

    # Strictly reject domestic-only airlines and pure domestic routes
    if any(da in airline for da in JAPAN_DOMESTIC_AIRLINE_NAMES):
        return False
    if airline_code in JAPAN_DOMESTIC_AIRLINE_CODES:
        return False

    full_text = f"{title} {promo.get('subtitle', '')} {dests} {promo.get('region_category', '')} {airline}"
    from crawler.destinations import classify_region, strip_emojis
    # region_category is strictly "뉴질랜드" | "일본"; city detail lives in destinations
    region_cat = classify_region(f"{title} {promo.get('subtitle', '')}", full_text)
    if region_cat is None:
        return False

    conn = get_connection()
    cursor = conn.cursor()
    now = now_kst_iso()
    
    cursor.execute("SELECT id FROM sent_notifications WHERE id = ?", (promo["id"],))
    already_notified = cursor.fetchone() is not None

    cursor.execute("SELECT id FROM promotions WHERE id = ?", (promo["id"],))
    is_new = cursor.fetchone() is None
    
    cursor.execute('''
        INSERT INTO promotions (
            id, airline, airline_code, title, subtitle, badge_text, detail_url, image_url,
            promo_start, promo_end, travel_period, is_international, region_category, destinations,
            status, is_featured, created_at, updated_at
        ) VALUES (
            :id, :airline, :airline_code, :title, :subtitle, :badge_text, :detail_url, :image_url,
            :promo_start, :promo_end, :travel_period, :is_international, :region_category, :destinations,
            :status, :is_featured, :created_at, :updated_at
        )
        ON CONFLICT(id) DO UPDATE SET
            title=excluded.title,
            subtitle=excluded.subtitle,
            badge_text=excluded.badge_text,
            detail_url=excluded.detail_url,
            image_url=COALESCE(excluded.image_url, promotions.image_url),
            promo_start=COALESCE(excluded.promo_start, promotions.promo_start),
            promo_end=COALESCE(excluded.promo_end, promotions.promo_end),
            travel_period=COALESCE(excluded.travel_period, promotions.travel_period),
            is_international=1,
            region_category=excluded.region_category,
            destinations=excluded.destinations,
            status=excluded.status,
            updated_at=excluded.updated_at
    ''', {
        "id": promo["id"],
        "airline": promo["airline"],
        "airline_code": promo["airline_code"],
        "title": strip_emojis(promo["title"]),
        "subtitle": strip_emojis(promo.get("subtitle", "")),
        "badge_text": strip_emojis(promo.get("badge_text", "")),
        "detail_url": promo["detail_url"],
        "image_url": promo.get("image_url", ""),
        "promo_start": promo.get("promo_start"),
        "promo_end": promo.get("promo_end"),
        "travel_period": promo.get("travel_period", ""),
        "is_international": 1,
        "region_category": region_cat,
        "destinations": promo.get("destinations", "뉴질랜드 전역" if region_cat == "뉴질랜드" else "일본"),
        "status": promo.get("status", "ING"),
        "is_featured": promo.get("is_featured", 0),
        "created_at": now,
        "updated_at": now,
    })
    
    conn.commit()

    # Send instant push alert ONLY if it is truly new AND never sent before
    if is_new and not already_notified:
        try:
            from crawler.notifier import send_promotion_alert
            sent_ok = send_promotion_alert(promo)
            if sent_ok:
                cursor.execute(
                    "INSERT OR REPLACE INTO sent_notifications (id, airline, title, detail_url, sent_at) VALUES (?, ?, ?, ?, ?)",
                    (promo["id"], promo["airline"], promo["title"], promo["detail_url"], now)
                )
                conn.commit()
        except Exception as e:
            print(f"[Notifier] Failed to send Telegram alert: {e}")

    conn.close()
    return True

def log_crawl(airline: str, status: str, items_found: int, items_saved: int, error_message: Optional[str], started_at: str, finished_at: str):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO crawl_logs (airline, status, items_found, items_saved, error_message, started_at, finished_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (airline, status, items_found, items_saved, error_message, started_at, finished_at))
    conn.commit()
    conn.close()

def export_data_to_json():
    """Exports promotions and news articles from SQLite DB to JSON files for GitHub hosting and static deployment."""
    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT * FROM promotions ORDER BY promo_start DESC NULLS LAST, created_at DESC")
    promotions = [dict(row) for row in cursor.fetchall()]

    cursor.execute("SELECT * FROM news_articles ORDER BY published_at DESC, created_at DESC")
    news = [dict(row) for row in cursor.fetchall()]
    conn.close()

    export_dirs = [
        DB_DIR,
        os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "web", "public", "data"))
    ]

    for target_dir in export_dirs:
        try:
            os.makedirs(target_dir, exist_ok=True)
            with open(os.path.join(target_dir, "promotions.json"), "w", encoding="utf-8") as f:
                json.dump(promotions, f, ensure_ascii=False, indent=2)
            with open(os.path.join(target_dir, "news.json"), "w", encoding="utf-8") as f:
                json.dump(news, f, ensure_ascii=False, indent=2)
        except Exception as e:
            print(f"[Export JSON] Failed to export to {target_dir}: {e}")

    print(f"[Export JSON] Exported {len(promotions)} promotions and {len(news)} news articles to JSON.")
    return {"promotions_count": len(promotions), "news_count": len(news)}

if __name__ == '__main__':
    init_db()
    export_data_to_json()
    print("Database initialized at:", DB_PATH)
