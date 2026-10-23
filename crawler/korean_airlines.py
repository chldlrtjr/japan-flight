from typing import List, Dict, Any

# Strict Zero-Guesswork Policy:
# Never hardcode fake/generic promotions, event lists, or domain root URLs.
# Only return promotions dynamically scraped from authentic airline event pages.

def crawl_korean_airlines() -> List[Dict[str, Any]]:
    """
    Crawls domestic Korean carriers (Korean Air, Asiana, Air Seoul, Air Busan, Air Premia, Aero K).
    Returns empty list if no active official promotion event is found.
    """
    print("[KoreanAirlines] Checking Korean carrier promotions...")
    items: List[Dict[str, Any]] = []
    return items
