import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime
from typing import List, Dict, Any
from .destinations import analyze_promotion, extract_dates

TWAY_URL = "https://www.twayair.com/app/promotion/event/being"
TWAY_BASE = "https://www.twayair.com"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
}

def crawl_twayair() -> List[Dict[str, Any]]:
    print("[TwayAir] Starting crawl...")
    items = []
    try:
        res = requests.get(TWAY_URL, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"[TwayAir] Failed with status code: {res.status_code}")
            return items

        soup = BeautifulSoup(res.text, 'html.parser')
        event_cards = soup.select('.evt_wrap .evt_list li')
        print(f"[TwayAir] Found {len(event_cards)} raw cards")

        for li in event_cards:
            try:
                a_tag = li.find('a')
                if not a_tag:
                    continue

                event_seq = a_tag.get('data-eventseq', '')
                event_title = a_tag.get('data-eventtitle', '')
                
                # Check status
                is_ended = 'end' in li.get('class', [])
                
                # Title from strong span or data-eventtitle
                strong_tag = li.find('strong')
                title = strong_tag.get_text(separator=' ', strip=True) if strong_tag else event_title
                title = title.replace('[종료]', '').strip()

                sub_tag = li.select_one('.sbj_sub')
                subtitle = sub_tag.get_text(strip=True) if sub_tag else ""

                img_tag = li.find('img')
                image_url = img_tag.get('src', '') if img_tag else ""

                # Date paragraph (look for text with ~)
                date_paras = [p.get_text(strip=True) for p in li.find_all('p') if '~' in p.get_text()]
                date_text = date_paras[0] if date_paras else ""
                start_date, end_date = extract_dates(date_text)

                event_id = f"tway_{event_seq}" if event_seq else f"tway_{hash(title)}"
                add_info = a_tag.get('data-addinfo', '')
                if add_info:
                    encoded_info = add_info.replace('+', '-').replace('/', '_')
                    detail_url = f"https://www.trinityairways.com/app/promotion/event/retrieve/{encoded_info}/being/n"
                else:
                    detail_url = "https://www.trinityairways.com/app/promotion/event/being"

                # Analyze destination and region
                is_intl, region, destinations = analyze_promotion(title, subtitle, date_text)

                status = "END" if is_ended else "ING"
                if end_date and status == "ING":
                    today = datetime.now().strftime("%Y-%m-%d")
                    if end_date < today:
                        status = "END"

                badge = "특가 프로모션"
                if "얼리버드" in title or "얼리버드" in subtitle:
                    badge = "얼리버드"
                elif "쿠폰" in title or "쿠폰" in subtitle:
                    badge = "쿠폰할인"
                elif "신규" in title or "취항" in title:
                    badge = "신규취항"

                items.append({
                    "id": event_id,
                    "airline": "티웨이항공",
                    "airline_code": "TWAY",
                    "title": title,
                    "subtitle": subtitle,
                    "badge_text": badge,
                    "detail_url": detail_url,
                    "image_url": image_url,
                    "promo_start": start_date,
                    "promo_end": end_date,
                    "travel_period": date_text,
                    "is_international": is_intl,
                    "region_category": region,
                    "destinations": destinations,
                    "status": status,
                    "is_featured": 1 if status == "ING" else 0
                })
            except Exception as e:
                print(f"[TwayAir] Error parsing item: {e}")

    except Exception as e:
        print(f"[TwayAir] Fetch error: {e}")

    print(f"[TwayAir] Crawled total {len(items)} promotions")
    return items

if __name__ == '__main__':
    res = crawl_twayair()
    for r in res[:5]:
        print(r['id'], r['title'], r['region_category'], r['status'])
