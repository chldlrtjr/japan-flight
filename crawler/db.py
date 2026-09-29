import os
import json
import sqlite3
from datetime import datetime
from typing import List, Dict, Any, Optional

DB_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
DB_PATH = os.path.join(DB_DIR, "promotions.db")

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
            id TEXT PRIMARY KEY,               -- e.g. "jeju_0000004293" or hash
            airline TEXT NOT NULL,             -- "제주항공", "티웨이항공", "이스타항공", "진에어" 등
            airline_code TEXT NOT NULL,        -- "JEJU", "TWAY", "EASTAR", "JIN"
            title TEXT NOT NULL,               -- 프로모션 제목
            subtitle TEXT,                     -- 부제목/요약
            badge_text TEXT,                   -- "최대 82% 할인", "신규취항", "얼리버드"
            detail_url TEXT NOT NULL,          -- 상세 링크
            image_url TEXT,                    -- 배너/이미지 URL
            promo_start TEXT,                  -- 프로모션 시작일 (YYYY-MM-DD)
            promo_end TEXT,                    -- 프로모션 종료일 (YYYY-MM-DD)
            travel_period TEXT,                -- 탑승 기간 텍스트
            is_international INTEGER DEFAULT 1, -- 국제선 여부 (1=국제선, 0=국내선)
            region_category TEXT,              -- "일본", "동남아", "중화권", "유럽/미주", "대양주/기타", "전노선"
            destinations TEXT,                 -- 콤마 구분 목적지 (예: "도쿄,오사카,후쿠오카")
            status TEXT DEFAULT 'ING',         -- "ING" (진행중), "UPCOMING" (예정), "END" (종료)
            is_featured INTEGER DEFAULT 0,     -- 주요 특가 여부
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
            status TEXT NOT NULL,              -- "SUCCESS", "FAILED"
            items_found INTEGER DEFAULT 0,
            items_saved INTEGER DEFAULT 0,
            error_message TEXT,
            started_at TEXT NOT NULL,
            finished_at TEXT NOT NULL
        )
    ''')

    # Create news articles table (focused on promotions & Japan deals)
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS news_articles (
            id TEXT PRIMARY KEY,               -- hash or link
            title TEXT NOT NULL,
            summary TEXT,
            source TEXT NOT NULL,              -- 언론사명 (연합뉴스, 매일경제 등)
            link TEXT NOT NULL UNIQUE,
            published_at TEXT,
            airline TEXT,                      -- 언급된 항공사 (제주항공, 진에어 등)
            is_japan INTEGER DEFAULT 0,        -- 🇯🇵 일본 관련 여부 (1 or 0)
            japan_cities TEXT,                 -- "도쿄, 오사카, 후쿠오카"
            region_category TEXT,
            promo_status TEXT DEFAULT 'ACTIVE', -- "ACTIVE" (진행중), "UPCOMING" (예정)
            promo_period_desc TEXT,            -- "가을·겨울 시즌 특가", "10~12월 출발" 등
            created_at TEXT NOT NULL
        )
    ''')

    # Migration: add columns if table already exists
    try:
        cursor.execute("ALTER TABLE news_articles ADD COLUMN promo_status TEXT DEFAULT 'ACTIVE'")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE news_articles ADD COLUMN promo_period_desc TEXT")
    except Exception:
        pass
    try:
        cursor.execute("ALTER TABLE news_articles ADD COLUMN promo_end TEXT")
    except Exception:
        pass

    # Automatically clean expired or irrelevant articles
    cursor.execute("""
        DELETE FROM news_articles 
        WHERE title LIKE '%숏트립%' 
           OR title LIKE '%렌터카%' 
           OR title LIKE '%카카오페이%' 
           OR title LIKE '%맛집%'
           OR (promo_end IS NOT NULL AND promo_end < '2026-09-29')
           OR (promo_end IS NULL AND published_at < '2026-09-19')
    """)

    conn.commit()
    conn.close()

def upsert_news(news: Dict[str, Any]) -> bool:
    # Strictly reject non-Japan news
    if news.get("is_japan", 0) != 1:
        return False

    # Strictly reject expired or non-flight keywords
    for kw in ['숏트립', '렌터카', '카카오페이', '맛집', '숙소']:
        if kw in news.get('title', ''):
            return False

    # Reject if promo_end is in the past
    if news.get("promo_end") and news["promo_end"] < "2026-09-29":
        return False

    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
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
        "is_japan": 1,
        "japan_cities": news.get("japan_cities", "일본"),
        "region_category": "일본",
        "promo_status": news.get("promo_status", "ACTIVE"),
        "promo_period_desc": news.get("promo_period_desc", "실시간 진행중"),
        "promo_end": news.get("promo_end"),
        "created_at": now
    })
    
    conn.commit()
    conn.close()
    return True

def upsert_promotion(promo: Dict[str, Any]) -> bool:
    # Strictly reject non-Japan promotions
    full_text = f"{promo.get('title', '')} {promo.get('subtitle', '')} {promo.get('destinations', '')} {promo.get('region_category', '')} {promo.get('airline', '')}"
    from .destinations import is_japan_promo
    if not is_japan_promo(full_text):
        return False

    conn = get_connection()
    cursor = conn.cursor()
    now = datetime.now().isoformat()
    
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
            region_category='일본',
            destinations=excluded.destinations,
            status=excluded.status,
            updated_at=excluded.updated_at
    ''', {
        "id": promo["id"],
        "airline": promo["airline"],
        "airline_code": promo["airline_code"],
        "title": promo["title"],
        "subtitle": promo.get("subtitle", ""),
        "badge_text": promo.get("badge_text", ""),
        "detail_url": promo["detail_url"],
        "image_url": promo.get("image_url", ""),
        "promo_start": promo.get("promo_start"),
        "promo_end": promo.get("promo_end"),
        "travel_period": promo.get("travel_period", ""),
        "is_international": 1,
        "region_category": "일본",
        "destinations": promo.get("destinations", "일본"),
        "status": promo.get("status", "ING"),
        "is_featured": promo.get("is_featured", 0),
        "created_at": now,
        "updated_at": now,
    })
    
    conn.commit()
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
    """Exports promotions and news articles from SQLite DB to JSON files for GitHub hosting, Vercel, and static deployment."""
    conn = get_connection()
    cursor = conn.cursor()

    # 1. Fetch promotions
    cursor.execute("SELECT * FROM promotions ORDER BY is_featured DESC, updated_at DESC")
    promotions = [dict(row) for row in cursor.fetchall()]

    # 2. Fetch news articles
    cursor.execute("SELECT * FROM news_articles ORDER BY is_japan DESC, published_at DESC, created_at DESC")
    news = [dict(row) for row in cursor.fetchall()]
    conn.close()

    # Paths to export
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
