import asyncio
from playwright.async_api import async_playwright
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any
from .destinations import analyze_promotion, extract_dates

JINAIR_URL = "https://www.jinair.com/promotion/eventList"
JINAIR_BASE = "https://www.jinair.com"

# Zero-Guesswork Policy: Never inject fallback fake/mock promotions or generic eventList URLs.

async def crawl_jinair_async() -> List[Dict[str, Any]]:
    print("[JinAir] Attempting Playwright crawl...")
    items = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                locale="ko-KR"
            )
            page = await context.new_page()
            await page.add_init_script("delete Object.getPrototypeOf(navigator).webdriver")
            
            await page.goto(JINAIR_URL, timeout=15000, wait_until="domcontentloaded")
            await page.wait_for_timeout(4000)
            
            raw_cards = await page.evaluate('''() => {
                const list = [];
                const cards = document.querySelectorAll('.event-list li, .event_box, .list_item, a[href*="eventView"]');
                cards.forEach(c => {
                    const text = c.innerText ? c.innerText.trim() : '';
                    const a = c.querySelector('a') || (c.tagName === 'A' ? c : null);
                    const img = c.querySelector('img');
                    if (text && text.length > 5) {
                        list.push({
                            fullText: text,
                            url: a ? a.href : '',
                            img: img ? img.src : ''
                        });
                    }
                });
                return list;
            }''')
            await browser.close()
            
            for c in raw_cards:
                url = c.get('url', '').strip()
                # Must be a specific event detail URL, not the generic eventList
                if not url or url.rstrip('/') == JINAIR_URL.rstrip('/') or 'eventView' not in url:
                    continue

                lines = [l.strip() for l in c['fullText'].split('\n') if l.strip()]
                title = lines[0] if lines else "진에어 프로모션"
                sub = lines[1] if len(lines) > 1 else ""
                start_date, end_date = extract_dates(c['fullText'])
                is_intl, region, destinations = analyze_promotion(title, sub, c['fullText'])
                
                items.append({
                    "id": f"jin_{hash(url + title)}",
                    "airline": "진에어",
                    "airline_code": "JIN",
                    "title": title,
                    "subtitle": sub,
                    "badge_text": "특가",
                    "detail_url": url,
                    "image_url": c.get('img', ''),
                    "promo_start": start_date,
                    "promo_end": end_date,
                    "travel_period": c['fullText'],
                    "is_international": is_intl,
                    "region_category": region,
                    "destinations": destinations,
                    "status": "ING",
                    "is_featured": 1
                })
    except Exception as e:
        print(f"[JinAir] Playwright failed or challenge active: {e}")

    print(f"[JinAir] Total {len(items)} promotions ready")
    return items

def crawl_jinair() -> List[Dict[str, Any]]:
    return asyncio.run(crawl_jinair_async())
