import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime
from typing import List, Dict, Any
from .destinations import analyze_promotion, extract_dates

JEJU_URL = "https://www.jejuair.net/ko/event/event.do"
BASE_URL = "https://www.jejuair.net"

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
}

def crawl_jejuair() -> List[Dict[str, Any]]:
    print("[JejuAir] Starting crawl...")
    items = []
    try:
        res = requests.get(JEJU_URL, headers=HEADERS, timeout=15)
        if res.status_code != 200:
            print(f"[JejuAir] Failed with status code: {res.status_code}")
            return items

        soup = BeautifulSoup(res.text, 'html.parser')
        
        # 1. Main Top Banners / Carousels
        carousel_items = soup.select('.event-top-banner, .main-carousel__item')
        print(f"[JejuAir] Found {len(carousel_items)} carousel items")
        for elem in carousel_items:
            try:
                a_tag = elem.find('a', href=re.compile(r'/ko/event/eventDetail\.do\?eventNo=\d+'))
                if not a_tag:
                    continue
                
                href = a_tag.get('href', '')
                detail_url = BASE_URL + href if href.startswith('/') else href
                
                # Extract eventNo
                ev_match = re.search(r'eventNo=(\d+)', href)
                event_id = f"jeju_{ev_match.group(1)}" if ev_match else f"jeju_{hash(detail_url)}"
                
                # Background image
                bg_div = elem.select_one('.event-top-banner') or elem
                bg_style = bg_div.get('style', '')
                img_url = ""
                img_match = re.search(r'url\((.*?)\)', bg_style)
                if img_match:
                    img_url = img_match.group(1).strip('"\'')
                
                badge_elem = elem.select_one('.event-banner__text')
                badge_text = badge_elem.get_text(strip=True) if badge_elem else ""
                
                title_elem = elem.select_one('.event-banner__title')
                title = title_elem.get_text(separator=' ', strip=True) if title_elem else ""
                
                date_elem = elem.select_one('.event-banner__date, .event-banner__bottom')
                date_text = date_elem.get_text(separator=' ', strip=True) if date_elem else ""
                start_date, end_date = extract_dates(date_text)
                
                is_intl, region, destinations = analyze_promotion(title, badge_text, date_text)
                
                # Determine status
                status = "ING"
                if end_date:
                    try:
                        today = datetime.now().strftime("%Y-%m-%d")
                        if end_date < today:
                            status = "END"
                    except Exception:
                        pass
                
                items.append({
                    "id": event_id,
                    "airline": "제주항공",
                    "airline_code": "JEJU",
                    "title": title,
                    "subtitle": badge_text,
                    "badge_text": badge_text,
                    "detail_url": detail_url,
                    "image_url": img_url,
                    "promo_start": start_date,
                    "promo_end": end_date,
                    "travel_period": date_text,
                    "is_international": is_intl,
                    "region_category": region,
                    "destinations": destinations,
                    "status": status,
                    "is_featured": 1
                })
            except Exception as e:
                print(f"[JejuAir] Error parsing carousel item: {e}")

        # 2. General Event Grid Items
        grid_items = soup.select('.event-card, .event-list__item, li:has(a[href*="eventDetail"])')
        print(f"[JejuAir] Found {len(grid_items)} grid items")
        for elem in grid_items:
            try:
                a_tag = elem.find('a', href=re.compile(r'/ko/event/eventDetail\.do\?eventNo=\d+'))
                if not a_tag:
                    continue
                
                href = a_tag.get('href', '')
                detail_url = BASE_URL + href if href.startswith('/') else href
                ev_match = re.search(r'eventNo=(\d+)', href)
                event_id = f"jeju_{ev_match.group(1)}" if ev_match else f"jeju_{hash(detail_url)}"
                
                # If already added from carousel, skip
                if any(x['id'] == event_id for x in items):
                    continue

                img_tag = elem.find('img')
                img_url = img_tag.get('src', '') if img_tag else ""
                if img_url and not img_url.startswith('http'):
                    img_url = BASE_URL + img_url

                title_elem = elem.select_one('.title, .event-title, strong, dt')
                title = title_elem.get_text(separator=' ', strip=True) if title_elem else a_tag.get_text(strip=True)
                
                date_elem = elem.select_one('.date, .period, dd, p')
                date_text = date_elem.get_text(separator=' ', strip=True) if date_elem else ""
                start_date, end_date = extract_dates(date_text)
                
                badge_elem = elem.select_one('.badge, .tag, .flag')
                badge_text = badge_elem.get_text(strip=True) if badge_elem else ""

                is_intl, region, destinations = analyze_promotion(title, badge_text, date_text)
                
                status = "ING"
                if end_date:
                    try:
                        today = datetime.now().strftime("%Y-%m-%d")
                        if end_date < today:
                            status = "END"
                    except Exception:
                        pass

                items.append({
                    "id": event_id,
                    "airline": "제주항공",
                    "airline_code": "JEJU",
                    "title": title,
                    "subtitle": badge_text,
                    "badge_text": badge_text,
                    "detail_url": detail_url,
                    "image_url": img_url,
                    "promo_start": start_date,
                    "promo_end": end_date,
                    "travel_period": date_text,
                    "is_international": is_intl,
                    "region_category": region,
                    "destinations": destinations,
                    "status": status,
                    "is_featured": 0
                })
            except Exception as e:
                print(f"[JejuAir] Error parsing grid item: {e}")

    except Exception as e:
        print(f"[JejuAir] Fetch exception: {e}")

    print(f"[JejuAir] Crawled total {len(items)} promotions")
    return items

if __name__ == '__main__':
    res = crawl_jejuair()
    for r in res:
        print(r['id'], r['title'], r['region_category'], r['destinations'], r['status'])
