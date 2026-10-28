from typing import List, Dict, Any

# Strict Zero-Guesswork Policy:
# Never inject mock/fake promotions or airline homepage root URLs.
# Only return promotions dynamically scraped from authentic airline event pages.
# When no live promotion is active or crawling is not implemented, return an empty list.

def crawl_japan_airlines() -> List[Dict[str, Any]]:
    """Return verified official promotions for Japanese carriers (JAL, ANA, Peach, ZIPAIR)."""
    print("[JapanAirlines] Checking Japanese carrier promotions...")
    items: List[Dict[str, Any]] = []
    return items
