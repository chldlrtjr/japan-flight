import os
import re
import json
import requests
from typing import List, Dict

# Watches official airline sitemaps for newly published campaign pages.
# New URLs are only reported (Telegram) for human verification - never auto-registered,
# because a sitemap entry alone does not prove a live, renderable promotion.

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "data"))
STATE_PATH = os.path.join(DATA_DIR, "sitemap_seen.json")

SOURCES = [
    {
        "name": "에어뉴질랜드",
        "sitemap": "https://www.airnewzealand.co.kr/sitemap-pages.xml",
        # Standing list pages already known to be non-promotions (AGENTS.md)
        "ignore": [r"/flight-deals-to-", r"fare-conditions", r"fare-rules", r"special-assistance"],
    },
]

DEAL_PATTERN = re.compile(r"sale|deal|special|promo|offer|campaign|event|특가", re.I)

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9',
}

def _load_state() -> Dict[str, List[str]]:
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def _save_state(state: Dict[str, List[str]]):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f, ensure_ascii=False, indent=2, sort_keys=True)

def watch_sitemaps() -> List[Dict[str, str]]:
    """Returns [{airline, url}] for newly appeared deal-like pages and sends a Telegram alert."""
    state = _load_state()
    found: List[Dict[str, str]] = []

    for src in SOURCES:
        try:
            r = requests.get(src["sitemap"], headers=HEADERS, timeout=20)
            r.raise_for_status()
        except Exception as e:
            print(f"[SitemapWatcher] {src['name']} sitemap fetch failed: {e}")
            continue

        urls = sorted(set(re.findall(r"<loc>\s*([^<\s]+)\s*</loc>", r.text)))
        if not urls:
            print(f"[SitemapWatcher] {src['name']} sitemap returned no URLs; state kept")
            continue

        first_run = src["sitemap"] not in state
        seen = set(state.get(src["sitemap"], []))
        state[src["sitemap"]] = urls

        if first_run:
            print(f"[SitemapWatcher] {src['name']} baseline recorded ({len(urls)} URLs)")
            continue

        for u in urls:
            if u in seen or not DEAL_PATTERN.search(u):
                continue
            if any(re.search(p, u) for p in src["ignore"]):
                continue
            found.append({"airline": src["name"], "url": u})

    _save_state(state)

    if found:
        print(f"[SitemapWatcher] {len(found)} new candidate page(s) found")
        lines = [f"- {f['airline']}: {f['url']}" for f in found]
        message = (
            "<b>[검증 필요] 새 프로모션 후보 페이지</b>\n"
            + "\n".join(lines)
            + "\n\n브라우저로 확인 후 실제 이벤트면 data/manual_promotions.json에 등록하세요."
        )
        try:
            from crawler.notifier import send_telegram_message
            send_telegram_message(message)
        except Exception as e:
            print(f"[SitemapWatcher] Telegram alert failed: {e}")
    else:
        print("[SitemapWatcher] No new candidate pages")

    return found
