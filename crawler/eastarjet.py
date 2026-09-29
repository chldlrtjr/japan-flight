import asyncio
from playwright.async_api import async_playwright
import re
from datetime import datetime
from typing import List, Dict, Any
from .destinations import analyze_promotion, extract_dates

EASTAR_URL = "https://www.eastarjet.com/newstar/PGWTA00001"
EASTAR_BASE = "https://www.eastarjet.com"

async def crawl_eastarjet_async() -> List[Dict[str, Any]]:
    print("[EastarJet] Starting Playwright crawl...")
    items = []
    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
                locale="ko-KR",
                viewport={"width": 1280, "height": 800}
            )
            page = await context.new_page()
            await page.add_init_script("delete Object.getPrototypeOf(navigator).webdriver")
            
            await page.goto(EASTAR_URL, wait_until="domcontentloaded", timeout=25000)
            await page.wait_for_timeout(3000)
            
            raw_cards = await page.evaluate('''() => {
                const list = [];
                const cards = document.querySelectorAll('li, div[class*="event"], a[href*="PGWTA00002"]');
                cards.forEach(c => {
                    const text = c.innerText ? c.innerText.trim() : '';
                    const a = c.querySelector('a') || (c.tagName === 'A' ? c : null);
                    const img = c.querySelector('img');
                    if (text && (text.includes('~') || text.includes('특가') || text.includes('취항') || text.includes('할인')) && a && a.href.includes('PGWTA00002')) {
                        list.push({
                            fullText: text,
                            url: a.href,
                            img: img ? img.src : ''
                        });
                    }
                });
                return list;
            }''')
            
            await browser.close()
            
            seen_urls = set()
            today = datetime.now().strftime("%Y-%m-%d")

            for card in raw_cards:
                url = card.get('url', '')
                if not url or url in seen_urls:
                    continue
                seen_urls.add(url)
                
                full_text = card.get('fullText', '')
                lines = [line.strip() for line in full_text.split('\n') if line.strip()]
                title = lines[0] if lines else "이스타항공 프로모션"
                subtitle = lines[1] if len(lines) > 1 else ""

                ev_match = re.search(r'eventNo=(\d+)', url)
                event_id = f"eastar_{ev_match.group(1)}" if ev_match else f"eastar_{hash(url)}"
                
                start_date, end_date = extract_dates(full_text)
                is_intl, region, destinations = analyze_promotion(title, subtitle, full_text)

                status = "ING"
                if end_date and end_date < today:
                    status = "END"

                badge = "특가"
                if "취항" in title:
                    badge = "신규취항"
                elif "카드" in title:
                    badge = "제휴혜택"
                elif "얼리버드" in title:
                    badge = "얼리버드"

                items.append({
                    "id": event_id,
                    "airline": "이스타항공",
                    "airline_code": "EASTAR",
                    "title": title,
                    "subtitle": subtitle,
                    "badge_text": badge,
                    "detail_url": url,
                    "image_url": card.get('img', ''),
                    "promo_start": start_date,
                    "promo_end": end_date,
                    "travel_period": full_text,
                    "is_international": is_intl,
                    "region_category": region,
                    "destinations": destinations,
                    "status": status,
                    "is_featured": 1 if "취항" in title or "특가" in title else 0
                })

    except Exception as e:
        print(f"[EastarJet] Error crawling: {e}")

    print(f"[EastarJet] Crawled total {len(items)} promotions")
    return items

def crawl_eastarjet() -> List[Dict[str, Any]]:
    return asyncio.run(crawl_eastarjet_async())

if __name__ == '__main__':
    res = crawl_eastarjet()
    for r in res:
        print(r['id'], r['title'], r['region_category'], r['destinations'], r['status'])
