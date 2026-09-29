import urllib.request
import xml.etree.ElementTree as ET
import urllib.parse
import hashlib
import re
from datetime import datetime
from email.utils import parsedate_to_datetime
from typing import List, Dict, Any

from .destinations import analyze_japan_promotion

# Promotion must-haves
PROMO_MUST_HAVE = [
    '특가', '할인', '프로모션', '얼리버드', '세일', '초특가', '최저가', '반값',
    '만원', '쿠폰', '이벤트', '파격', '할인코드', '메가세일', '슈스페',
    '사이다 특가', '사이다', '진마켓', '슈퍼세일', '특가전', '페스타', '운임 할인',
    '항공권 세일', '혜택'
]

# Blacklist of non-promo, expired, or non-flight news
EXCLUDE_KEYWORDS = [
    '지연', '결항', '기체 결함', '고장', '사고', '보상', '비상착륙', '난기류',
    '주가', '영업익', '영업이익', '당기순익', '순이익', '실적', '노조', '파업',
    '채용', '국감', '국정감사', '과징금', '사망', '부채', '적자', '흑자',
    '대표이사', '사장 취임', '인사', '주총', '회항', '환승객', '직원', '임직원',
    '피해', '환불 거부', '승객 불편', '입국 사고', '슬롯', '카지노',
    '숏트립', '렌터카', '카카오페이', '맛집', '숙소'
]

JAPAN_CITIES = [
    "일본", "도쿄", "오사카", "후쿠오카", "삿포로", "오키나와", "나고야",
    "마쓰야마", "시즈오카", "히로시마", "가고시마", "다카마쓰", "오이타",
    "구마모토", "사가", "기타큐슈", "요나고", "간사이", "나리타", "하네다", "고베"
]

AIRLINE_KEYWORDS = {
    "피치항공": ["피치", "피치항공", "PEACH"],
    "집에어": ["집에어", "ZIPAIR"],
    "일본항공": ["일본항공", "JAL"],
    "전일본공수": ["전일본공수", "ANA"],
    "대한항공": ["대한항공", "KOREAN AIR", "KAL"],
    "아시아나항공": ["아시아나항공", "아시아나", "ASIANA", "AAR"],
    "제주항공": ["제주항공", "JEJU"],
    "진에어": ["진에어", "JINAIR", "진마켓"],
    "티웨이항공": ["티웨이", "티웨이항공", "TWAY"],
    "이스타항공": ["이스타", "이스타항공", "EASTAR"],
    "에어부산": ["에어부산", "AIR BUSAN"],
    "에어서울": ["에어서울", "AIR SEOUL"],
    "에어프레미아": ["에어프레미아", "AIR PREMIA"],
    "에어로케이": ["에어로케이", "AERO K"],
    "파라타항공": ["파라타항공", "파라타", "PARATA"],
}

QUERIES = [
    "일본 항공권 특가",
    "일본 항공권 프로모션",
    "피치항공 일본 특가",
    "피치항공 서울 오사카 당일치기 특가",
    "일본항공 특가 프로모션",
    "전일본공수 ANA 특가",
    "집에어 ZIPAIR 나리타",
    "에어프레미아 삿포로 취항 할인",
    "진에어 일본 노선 할인 프로모션",
    "에어서울 일본 전 노선 프로모션",
    "이스타항공 일본 특가",
    "제주항공 일본 노선 할인",
    "티웨이항공 일본 특가",
]

def detect_promo_status(title: str, summary: str, pub_date: str) -> tuple[str, str]:
    """
    Returns (status: 'ACTIVE' | 'UPCOMING', period_desc: string)
    """
    text = f"{title} {summary}"
    
    # Check for upcoming keywords
    is_upcoming = any(kw in text for kw in ['오픈 예정', '예고', '사전 예약', '미리 예매', '얼리버드', '취항 기념', '다음 달부터', '개시 예정'])
    status = 'UPCOMING' if is_upcoming else 'ACTIVE'

    # Extract target period description
    period_desc = "실시간 진행중"
    if '가을' in text and '겨울' in text:
        period_desc = "가을·겨울 시즌 특가"
    elif '가을' in text or '단풍' in text:
        period_desc = "가을 시즌 특가"
    elif '겨울' in text or '온천' in text:
        period_desc = "겨울·온천 시즌 특가"
    elif '연말' in text or '연초' in text:
        period_desc = "연말·연초 출발 특가"
    elif '추석' in text or '한가위' in text:
        period_desc = "추석·가을 연휴 특가"
    elif '10월' in text or '11월' in text or '12월' in text:
        period_desc = "10~12월 출발 특가"

    return status, period_desc

def is_valid_active_japan_promo(title: str, summary: str, pub_date: str) -> bool:
    full_text = f"{title} {summary}"

    # 1. Must be Japan-related
    if not any(city in full_text for city in JAPAN_CITIES):
        return False

    # 2. Reject blacklist keywords
    for kw in EXCLUDE_KEYWORDS:
        if kw in full_text:
            return False

    # 3. Must have promotion keyword
    if not any(pm in full_text for pm in PROMO_MUST_HAVE):
        return False

    # 4. Strict Date check: Must NOT be an expired historical news from weeks ago
    # Airline flash sales typically last 3-7 days.
    # We only accept news published in the recent 10 days (2026-09-19 onwards)
    if pub_date and pub_date < "2026-09-19":
        return False

    return True

def crawl_flight_news() -> List[Dict[str, Any]]:
    print("[NewsCrawler] Starting ACTIVE & UPCOMING Japan flight promotion crawl...")
    seen_links = set()
    articles = []

    for query in QUERIES:
        try:
            encoded_query = urllib.parse.quote(query)
            url = f"https://news.google.com/rss/search?q={encoded_query}&hl=ko&gl=KR&ceid=KR:ko"
            
            req = urllib.request.Request(url, headers={
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            })
            
            with urllib.request.urlopen(req, timeout=10) as resp:
                root = ET.fromstring(resp.read())
                items = root.findall('.//item')

                for item in items[:25]:
                    title_elem = item.find('title')
                    link_elem = item.find('link')
                    pub_elem = item.find('pubDate')
                    source_elem = item.find('source')
                    desc_elem = item.find('description')

                    title = title_elem.text.strip() if title_elem is not None and title_elem.text else ''
                    link = link_elem.text.strip() if link_elem is not None and link_elem.text else ''
                    pub_raw = pub_elem.text.strip() if pub_elem is not None and pub_elem.text else ''
                    source = source_elem.text.strip() if source_elem is not None and source_elem.text else '언론사'
                    summary = desc_elem.text.strip() if desc_elem is not None and desc_elem.text else ''

                    if not title or not link or link in seen_links:
                        continue

                    clean_title = re.sub(r'\s*-\s*[^-]+$', '', title).strip()

                    # Parse publication date to numeric format (YYYY-MM-DD or YYYY-MM-DD HH:MM)
                    pub_date_formatted = None
                    if pub_raw:
                        try:
                            dt = parsedate_to_datetime(pub_raw)
                            if dt.hour == 0 and dt.minute == 0:
                                pub_date_formatted = dt.strftime('%Y-%m-%d')
                            else:
                                pub_date_formatted = dt.strftime('%Y-%m-%d %H:%M')
                        except Exception:
                            m = re.search(r'(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})', pub_raw)
                            month_map = {'Jan': '01', 'Feb': '02', 'Mar': '03', 'Apr': '04', 'May': '05', 'Jun': '06', 'Jul': '07', 'Aug': '08', 'Sep': '09', 'Oct': '10', 'Nov': '11', 'Dec': '12'}
                            if m:
                                pub_date_formatted = f"{m.group(3)}-{month_map.get(m.group(2), '01')}-{m.group(1).zfill(2)}"
                            else:
                                pub_date_formatted = datetime.now().strftime('%Y-%m-%d')

                    # STRICT ACTIVE JAPAN PROMOTION FILTER
                    if not is_valid_active_japan_promo(clean_title, summary, pub_date_formatted or ''):
                        continue

                    seen_links.add(link)

                    # Detect mentioned airline
                    detected_airline = "일본 노선 항공사"
                    for air_name, syns in AIRLINE_KEYWORDS.items():
                        if any(s in clean_title for s in syns):
                            detected_airline = air_name
                            break

                    # Detect Japan cities
                    matched_japan_cities = []
                    for city in JAPAN_CITIES:
                        if city in clean_title:
                            if city != "일본" and city not in matched_japan_cities:
                                matched_japan_cities.append(city)

                    promo_status, period_desc = detect_promo_status(clean_title, summary, pub_date_formatted or '')
                    art_id = hashlib.md5(link.encode('utf-8')).hexdigest()

                    articles.append({
                        "id": f"news_{art_id}",
                        "title": clean_title,
                        "summary": summary if summary else clean_title,
                        "source": source,
                        "link": link,
                        "published_at": pub_date_formatted,
                        "airline": detected_airline,
                        "is_japan": 1,
                        "japan_cities": ", ".join(matched_japan_cities) if matched_japan_cities else "일본 전역",
                        "region_category": "일본",
                        "promo_status": promo_status,
                        "promo_period_desc": period_desc
                    })
        except Exception as e:
            print(f"[NewsCrawler] Error query '{query}': {e}")

    # Sort: newest first
    articles.sort(key=lambda x: x['published_at'] or '', reverse=True)
    print(f"[NewsCrawler] Collected {len(articles)} ACTIVE/UPCOMING Japan promotion articles")
    return articles

if __name__ == '__main__':
    arts = crawl_flight_news()
    for a in arts[:10]:
        print(f"[{a['promo_status']}] [{a['published_at']}] [{a['source']}] {a['title']} ({a['promo_period_desc']})")
