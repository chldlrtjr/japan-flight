import os
import sys
from datetime import datetime
from typing import Dict, Any, Optional, Tuple

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from crawler.db import get_connection, export_data_to_json
from crawler.url_verifier import is_promotion_valid
from crawler.news import is_valid_active_promo

def check_live_url_expired(url: str) -> Tuple[bool, str]:
    """Check if the detail page is invalid, empty, or expired."""
    is_valid, reason = is_promotion_valid(url)
    return (not is_valid), reason

def check_and_expire_promotions(today_str: Optional[str] = None, check_live: bool = False) -> Dict[str, Any]:
    """
    Checks all promotions and flight news in the database.
    Permanently DELETES any promotion that has ended (past promo_end date, status='END', or dead/expired page),
    so only 100% active, ongoing flight deals remain.
    """
    if not today_str:
        today_str = datetime.now().strftime("%Y-%m-%d")

    conn = get_connection()
    cursor = conn.cursor()

    # 1. Find promotions to delete
    cursor.execute("""
        SELECT id, airline, title, promo_end, status, detail_url
        FROM promotions
    """)
    rows = cursor.fetchall()

    delete_promo_ids = []
    delete_details = []

    for row in rows:
        p_id = row['id']
        airline = row['airline']
        title = row['title']
        promo_end = row['promo_end']
        status = row['status']
        detail_url = row['detail_url']

        is_expired = False
        reason = ""

        if status == 'END':
            is_expired = True
            reason = "종료 상태(END)"
        elif promo_end and promo_end < today_str:
            is_expired = True
            reason = f"기간 만료 ({promo_end} < {today_str})"
        elif check_live and detail_url:
            is_dead, fail_reason = check_live_url_expired(detail_url)
            if is_dead:
                is_expired = True
                reason = f"페이지 검증 탈락 ({fail_reason})"

        if is_expired:
            delete_promo_ids.append(p_id)
            delete_details.append({
                "id": p_id,
                "airline": airline,
                "title": title,
                "promo_end": promo_end,
                "reason": reason
            })

    # Permanently delete expired promotions from database
    if delete_promo_ids:
        cursor.executemany("DELETE FROM promotions WHERE id = ?", [(pid,) for pid in delete_promo_ids])

    # 2. Check and delete expired or invalid/irrelevant news articles
    cursor.execute("""
        SELECT id, title, summary, promo_end, promo_status, published_at
        FROM news_articles
    """)
    news_rows = cursor.fetchall()
    delete_news_ids = []

    for nrow in news_rows:
        n_id = nrow['id']
        n_end = nrow['promo_end']
        n_status = nrow['promo_status']
        n_pub = nrow['published_at']
        n_title = nrow['title']
        n_summary = nrow['summary'] or ''

        if not is_valid_active_promo(n_title, n_summary, n_pub or ''):
            delete_news_ids.append(n_id)
        elif n_status == 'END':
            delete_news_ids.append(n_id)
        elif n_end and n_end < today_str:
            delete_news_ids.append(n_id)
        elif not n_end and n_pub:
            pub_date = n_pub[:10]
            try:
                days_old = (datetime.now() - datetime.strptime(pub_date, "%Y-%m-%d")).days
                if days_old > 21:
                    delete_news_ids.append(n_id)
            except Exception:
                pass

    if delete_news_ids:
        cursor.executemany("DELETE FROM news_articles WHERE id = ?", [(nid,) for nid in delete_news_ids])

    conn.commit()

    # Remaining active counts
    cursor.execute("SELECT count(*) as cnt FROM promotions")
    remaining_promos = cursor.fetchone()['cnt']

    cursor.execute("SELECT count(*) as cnt FROM news_articles")
    remaining_news = cursor.fetchone()['cnt']

    conn.close()

    # Automatically re-export JSON data files
    export_data_to_json()

    print(f"[ExpireChecker] 기준일자: {today_str}")
    print(f"[ExpireChecker] 영구 삭제된 종료 특가: {len(delete_promo_ids)}건")
    for d in delete_details:
        print(f"   🗑️ [{d['airline']}] {d['title']} -> {d['reason']}")
    print(f"[ExpireChecker] 영구 삭제된 종료 기사: {len(delete_news_ids)}건")
    print(f"[ExpireChecker] 현재 남은 진행중 특가: {remaining_promos}건, 최신 기사: {remaining_news}건")

    return {
        "today": today_str,
        "deleted_promos_count": len(delete_promo_ids),
        "deleted_details": delete_details,
        "deleted_news_count": len(delete_news_ids),
        "remaining_promos": remaining_promos,
        "remaining_news": remaining_news
    }

if __name__ == '__main__':
    check_and_expire_promotions()
