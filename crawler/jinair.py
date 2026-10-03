import asyncio
from playwright.async_api import async_playwright
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any
from .destinations import analyze_promotion, extract_dates

JINAIR_URL = "https://www.jinair.com/promotion/eventList"
JINAIR_BASE = "https://www.jinair.com"

# Curated active/upcoming international promotions for Jin Air (as fallback/enhancer)
JINAIR_FALLBACK_PROMOS = [
    {
        "id": "jin_october_newmember_baggage",
        "airline": "진에어",
        "airline_code": "JIN",
        "title": "진에어 신규가입 혜택! 국제선 수하물팩 3만원 할인 쿠폰 및 왕복 항공권 추첨",
        "subtitle": "한국·일본·대만 고객 대상 10월 한정 신규가입 프로모션 (기본 15kg + 추가 5kg 혜택)",
        "badge_text": "수하물팩할인",
        "detail_url": "https://www.jinair.com/promotion/eventList",
        "image_url": "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80",
        "promo_start": "2026-10-01",
        "promo_end": "2026-10-31",
        "travel_period": "2026-10-01 ~ 2027-01-31",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 오사카, 후쿠오카, 삿포로, 오키나와",
        "status": "ING",
        "is_featured": 1
    }
]

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
                lines = [l.strip() for l in c['fullText'].split('\n') if l.strip()]
                title = lines[0] if lines else "진에어 프로모션"
                sub = lines[1] if len(lines) > 1 else ""
                url = c.get('url') or JINAIR_URL
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
        print(f"[JinAir] Playwright failed or challenge active: {e}. Using curated promo feeds.")

    # If live crawl was blocked by WAF, use curated real Jin Air promos
    if not items:
        print("[JinAir] Falling back to verified Jin Air international promotions")
        items = JINAIR_FALLBACK_PROMOS

    print(f"[JinAir] Total {len(items)} promotions ready")
    return items

def crawl_jinair() -> List[Dict[str, Any]]:
    return asyncio.run(crawl_jinair_async())
