import sys
import os
import json
from datetime import datetime

# Add current folder to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from crawler.db import init_db, upsert_promotion, upsert_news, log_crawl, get_connection, export_data_to_json
from crawler.jejuair import crawl_jejuair
from crawler.twayair import crawl_twayair
from crawler.eastarjet import crawl_eastarjet
from crawler.jinair import crawl_jinair
from crawler.japan_airlines import crawl_japan_airlines
from crawler.korean_airlines import crawl_korean_airlines
from crawler.news import crawl_flight_news

def run_all_crawlers() -> dict:
    started_all = datetime.now().isoformat()
    init_db()

    crawlers = [
        ("제주항공", "JEJU", crawl_jejuair),
        ("티웨이항공", "TWAY", crawl_twayair),
        ("이스타항공", "EASTAR", crawl_eastarjet),
        ("진에어", "JIN", crawl_jinair),
        ("국내 전 항공사(대한항공/아시아나/에어서울/에어부산/에어프레미아/에어로케이/파라타)", "KOREA_ALL", crawl_korean_airlines),
        ("일본 항공사(한일 노선: JAL/ANA/피치/집에어)", "JAPAN_ALL", crawl_japan_airlines),
    ]

    summary = {
        "timestamp": started_all,
        "results": {},
        "total_saved": 0,
        "total_international": 0
    }

    for name, code, crawl_func in crawlers:
        crawl_start = datetime.now().isoformat()
        print(f"\n==========================================")
        print(f"[{datetime.now().strftime('%H:%M:%S')}] Crawling {name}...")
        print(f"==========================================")
        try:
            items = crawl_func()
            saved_count = 0
            intl_count = 0
            for item in items:
                upsert_promotion(item)
                saved_count += 1
                if item.get("is_international", 0) == 1:
                    intl_count += 1

            crawl_end = datetime.now().isoformat()
            log_crawl(name, "SUCCESS", len(items), saved_count, None, crawl_start, crawl_end)
            
            summary["results"][code] = {
                "airline": name,
                "status": "SUCCESS",
                "count": saved_count,
                "international_count": intl_count
            }
            summary["total_saved"] += saved_count
            summary["total_international"] += intl_count
            print(f"[{name}] Saved {saved_count} promos ({intl_count} international)")
        except Exception as e:
            crawl_end = datetime.now().isoformat()
            log_crawl(name, "FAILED", 0, 0, str(e), crawl_start, crawl_end)
            summary["results"][code] = {
                "airline": name,
                "status": "FAILED",
                "error": str(e)
            }
            print(f"[{name}] Crawl failed: {e}")

    # News Crawl Step (Japan Deal Focus)
    print(f"\n==========================================")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Crawling Flight & Japan Deal News...")
    print(f"==========================================")
    try:
        news_items = crawl_flight_news()
        news_saved = 0
        japan_news_saved = 0
        for n in news_items:
            upsert_news(n)
            news_saved += 1
            if n.get("is_japan", 0) == 1:
                japan_news_saved += 1

        summary["news_saved"] = news_saved
        summary["news_japan_count"] = japan_news_saved
        print(f"[News] Saved {news_saved} articles (🇯🇵 Japan Deals: {japan_news_saved})")
    except Exception as e:
        summary["news_error"] = str(e)
        print(f"[News] Crawl failed: {e}")

    # Check & Take down Expired Promotions
    print(f"\n==========================================")
    print(f"[{datetime.now().strftime('%H:%M:%S')}] Checking & Taking down Expired Promotions...")
    print(f"==========================================")
    try:
        from crawler.expire_checker import check_and_expire_promotions
        expire_res = check_and_expire_promotions(check_live=True)
        summary["expired_promos_taken_down"] = expire_res.get("newly_expired_count", 0)
    except Exception as e:
        print(f"[ExpireChecker] Failed: {e}")

    # Query DB stats
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT count(*) as cnt FROM promotions")
    total_in_db = cursor.fetchone()["cnt"]
    cursor.execute("SELECT count(*) as cnt FROM promotions WHERE is_international = 1")
    intl_in_db = cursor.fetchone()["cnt"]
    cursor.execute("SELECT count(*) as cnt FROM promotions WHERE status = 'ING'")
    active_in_db = cursor.fetchone()["cnt"]
    cursor.execute("SELECT count(*) as cnt FROM news_articles")
    news_in_db = cursor.fetchone()["cnt"]
    cursor.execute("SELECT count(*) as cnt FROM news_articles WHERE is_japan = 1")
    japan_news_in_db = cursor.fetchone()["cnt"]
    conn.close()

    summary["db_total"] = total_in_db
    summary["db_international"] = intl_in_db
    summary["db_active"] = active_in_db
    summary["db_news_total"] = news_in_db
    summary["db_news_japan"] = japan_news_in_db

    # Export to JSON for GitHub Actions / Vercel static serving
    try:
        export_data_to_json()
    except Exception as e:
        print(f"[Warning] Failed to export JSON: {e}")

    return summary

if __name__ == '__main__':
    is_json = "--json" in sys.argv
    result = run_all_crawlers()
    if is_json:
        print("\n--- JSON_RESULT_START ---")
        print(json.dumps(result, ensure_ascii=False, indent=2))
        print("--- JSON_RESULT_END ---")
    else:
        print("\n==========================================")
        print(f"Crawl Completed! Total in DB: {result['db_total']} (International: {result['db_international']})")
        print("==========================================")
