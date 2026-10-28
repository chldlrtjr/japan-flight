import os
import json
import hashlib
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any

# Human-verified promotions for airlines that cannot be crawled (WAF, no event pages).
# Each entry must point at a real event detail page; every URL is re-verified on each run
# (generic/root URL guard + HTTP/browser render check) before it is returned.
#
# data/manual_promotions.json format:
# [
#   {
#     "airline": "대한항공",              (required)
#     "airline_code": "KE",              (required)
#     "title": "인천-오클랜드 특가",       (required, must name a Japan/NZ destination)
#     "detail_url": "https://...",       (required, event-specific detail page)
#     "promo_end": "2026-11-30",         (required, YYYY-MM-DD)
#     "promo_start": "2026-10-28",       (optional)
#     "subtitle": "", "travel_period": "", "image_url": ""   (optional; image must be official CDN)
#   }
# ]

MANUAL_PATH = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data", "manual_promotions.json"))
REQUIRED_FIELDS = ("airline", "airline_code", "title", "detail_url", "promo_end")
KST = timezone(timedelta(hours=9))

def crawl_manual_promotions() -> List[Dict[str, Any]]:
    print("[ManualPromotions] Loading human-verified promotions...")
    try:
        with open(MANUAL_PATH, "r", encoding="utf-8") as f:
            entries = json.load(f)
    except FileNotFoundError:
        return []

    from crawler.url_verifier import is_promotion_valid
    from crawler.destinations import analyze_promotion

    today = datetime.now(KST).strftime("%Y-%m-%d")
    items: List[Dict[str, Any]] = []

    for e in entries:
        missing = [k for k in REQUIRED_FIELDS if not e.get(k)]
        if missing:
            print(f"[ManualPromotions] Skipped (missing {missing}): {e.get('title')}")
            continue
        if e["promo_end"] < today:
            print(f"[ManualPromotions] Skipped (expired {e['promo_end']}): {e['title']}")
            continue

        ok, reason = is_promotion_valid(e["detail_url"])
        if not ok:
            print(f"[ManualPromotions] Rejected {e['detail_url']}: {reason}")
            continue

        is_supported, _, destinations = analyze_promotion(e["title"], e.get("subtitle", ""))
        if not is_supported:
            print(f"[ManualPromotions] Skipped (no Japan/NZ destination in title): {e['title']}")
            continue

        items.append({
            "id": "MANUAL_" + hashlib.sha1(e["detail_url"].encode("utf-8")).hexdigest()[:12],
            "airline": e["airline"],
            "airline_code": e["airline_code"],
            "title": e["title"],
            "subtitle": e.get("subtitle", ""),
            "detail_url": e["detail_url"],
            "image_url": e.get("image_url", ""),
            "promo_start": e.get("promo_start"),
            "promo_end": e["promo_end"],
            "travel_period": e.get("travel_period", ""),
            "is_international": 1,
            "destinations": destinations,
            "status": "ING",
        })
        print(f"[ManualPromotions] Verified: {e['title']} ({reason})")

    return items
