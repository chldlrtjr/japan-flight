import os
import sys
import re
from datetime import datetime
from typing import Dict, Any, List, Optional
import requests

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from crawler.db import get_connection, export_data_to_json

EXPIRED_PAGE_KEYWORDS = [
    '종료된 이벤트', '종료된 프로모션', '이벤트가 종료', '해당 이벤트는 종료',
    '판매가 마감', '판매가 종료', '마감되었습니다', '이벤트 기간이 만료',
    '종료된 행사', '존재하지 않는 이벤트'
]

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,ja;q=0.8,en;q=0.7'
}

def check_live_url_expired(url: str, timeout: int = 4) -> bool:
    """Check if the detail page returns 404 or contains messages indicating expiration."""
    if not url or not url.startswith('http'):
        return False
    try:
        res = requests.get(url, headers=HEADERS, timeout=timeout, allow_redirects=True)
        if res.status_code in [404, 410]:
            return True
        # Check text signals
        html = res.text[:15000]
        for kw in EXPIRED_PAGE_KEYWORDS:
            if kw in html:
                return True
    except Exception:
        # Network errors should not prematurely mark as expired
        pass
    return False

def check_and_expire_promotions(today_str: Optional[str] = None, check_live: bool = False) -> Dict[str, Any]:
    """
    Checks all promotions and flight news in the database.
    Marks promotions with past end dates (or dead/expired pages) as status='END'
    and takes them down from active feeds.
    """
    if not today_str:
        today_str = datetime.now().strftime("%Y-%m-%d")

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Check promotions with expired promo_end
    cursor.execute("""
        SELECT id, airline, title, promo_end, status, detail_url
        FROM promotions
    """)
    rows = cursor.fetchall()

    expired_promo_ids = []
    expired_details = []

    for row in rows:
        p_id = row['id']
        airline = row['airline']
        title = row['title']
        promo_end = row['promo_end']
        status = row['status']
        detail_url = row['detail_url']

        is_expired = False
        reason = ""

        # Condition A: promo_end is in the past
        if promo_end and promo_end < today_str:
            is_expired = True
            reason = f"기간 만료 ({promo_end} < {today_str})"
        
        # Condition B: Optional live URL check for active deals
        elif check_live and status != 'END' and detail_url:
            if check_live_url_expired(detail_url):
                is_expired = True
                reason = "웹페이지 종료 확인"

        if is_expired:
            if status != 'END':
                expired_promo_ids.append(p_id)
                expired_details.append({
                    "id": p_id,
                    "airline": airline,
                    "title": title,
                    "promo_end": promo_end,
                    "reason": reason
                })

    # Update database status to 'END'
    if expired_promo_ids:
        cursor.executemany(
            "UPDATE promotions SET status = 'END', updated_at = ? WHERE id = ?",
            [(datetime.now().isoformat(), pid) for pid in expired_promo_ids]
        )

    # 2. Check and expire news articles
    cursor.execute("""
        SELECT id, title, promo_end, promo_status, published_at
        FROM news_articles
        WHERE promo_status != 'END'
    """)
    news_rows = cursor.fetchall()
    expired_news_ids = []

    for nrow in news_rows:
        n_id = nrow['id']
        n_end = nrow['promo_end']
        n_pub = nrow['published_at']

        if n_end and n_end < today_str:
            expired_news_ids.append(n_id)
        elif not n_end and n_pub:
            # If news is older than 21 days with no end date, mark as expired
            pub_date = n_pub[:10]
            try:
                days_old = (datetime.now() - datetime.strptime(pub_date, "%Y-%m-%d")).days
                if days_old > 21:
                    expired_news_ids.append(n_id)
            except Exception:
                pass

    if expired_news_ids:
        cursor.executemany(
            "UPDATE news_articles SET promo_status = 'END' WHERE id = ?",
            [(nid,) for nid in expired_news_ids]
        )

    conn.commit()

    # Get remaining active counts
    cursor.execute("SELECT count(*) as cnt FROM promotions WHERE status = 'ING'")
    active_promos_count = cursor.fetchone()['cnt']

    cursor.execute("SELECT count(*) as cnt FROM promotions WHERE status = 'END'")
    ended_promos_count = cursor.fetchone()['cnt']

    cursor.execute("SELECT count(*) as cnt FROM news_articles WHERE promo_status = 'ACTIVE'")
    active_news_count = cursor.fetchone()['cnt']

    conn.close()

    # Automatically re-export JSON data files
    export_result = export_data_to_json()

    print(f"[ExpireChecker] 기준일자: {today_str}")
    print(f"[ExpireChecker] 종료 처리된 특가 프로모션: {len(expired_promo_ids)}건")
    for d in expired_details:
        print(f"   🔻 [{d['airline']}] {d['title']} -> {d['reason']}")
    print(f"[ExpireChecker] 종료 처리된 뉴스 기사: {len(expired_news_ids)}건")
    print(f"[ExpireChecker] 현재 진행 중인 특가: {active_promos_count}건 (종료됨: {ended_promos_count}건)")

    return {
        "today": today_str,
        "newly_expired_count": len(expired_promo_ids),
        "expired_promotions": expired_details,
        "newly_expired_news_count": len(expired_news_ids),
        "active_promos_count": active_promos_count,
        "ended_promos_count": ended_promos_count,
        "active_news_count": active_news_count
    }

if __name__ == '__main__':
    check_and_expire_promotions()
