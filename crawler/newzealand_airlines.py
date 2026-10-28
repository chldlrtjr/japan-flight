from typing import List, Dict, Any

# Strict Zero-Guesswork Policy:
# Never hardcode fake/generic promotions or domain root URLs (e.g. csair.com/kr/ko/).
# Only live, empirically verified scrapers with authentic event pages are permitted.
# When no live promotion is active or crawling is not implemented, return an empty list.

def crawl_newzealand_airlines() -> List[Dict[str, Any]]:
    """
    Crawls New Zealand flight promotions from official airline websites.
    Returns empty list if no active official promotion event is found.
    (Never inject mock/fake promotions or airline homepage root URLs)
    """
    print("[NewZealandAirlines] Checking official New Zealand flight promotions...")
    items: List[Dict[str, Any]] = []
    # Source survey (2026-10-28) - no crawlable event-specific page exists yet:
    # - Air New Zealand KR: only a standing fare table at /flight-deals-to-new-zealand
    #   (generic list page, blocked by AGENTS.md); sitemap has no per-promotion pages.
    # - Korean Air: WAF rejects automated browsers (ERR_HTTP2_PROTOCOL_ERROR / timeout).
    # - China Southern KR: only a China-bound special-offer SPA list, nothing NZ-specific.
    return items
