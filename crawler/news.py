import urllib.request
import xml.etree.ElementTree as ET
import urllib.parse
import hashlib
import re
import time
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from typing import List, Dict, Any
from bs4 import BeautifulSoup

from .destinations import analyze_japan_promotion

# Promotion must-haves
PROMO_MUST_HAVE = [
    '특가', '할인', '프로모션', '얼리버드', '세일', '초특가', '최저가', '반값',
    '만원', '쿠폰', '이벤트', '파격', '할인코드', '메가세일', '슈스페',
    '사이다 특가', '사이다', '진마켓', '슈퍼세일', '특가전', '페스타', '운임',
    '취항 기념', '신규 취항', '노선 특가', '할인전', '혜택 대전', '발권'
]

# Blacklist of non-promo, corporate PR, awards, incidents, or non-flight products
EXCLUDE_KEYWORDS = [
    # Incidents / Safety
    '지연', '결항', '기체 결함', '고장', '사고', '보상', '비상착륙', '난기류',
    '회항', '환승객', '환불 거부', '승객 불편', '입국 사고', '슬롯', '사망', '피해',
    # Financial / Corporate / Labor
    '주가', '영업익', '영업이익', '당기순익', '순이익', '실적', '노조', '파업',
    '채용', '국감', '국정감사', '과징금', '부채', '적자', '흑자',
    '대표이사', '사장 취임', '인사', '주총', '직원', '임직원',
    '투자심리', '테마주', '데이터센터', '인수합병', 'M&A', '항공주',
    # Non-flight corporate / technology / CSR / awards
    '삼성전자', '카드업계', '카드사', '신용카드', '체크카드', '마일리지 카드', '캐시백',
    '항공정비', '인재 양성', '사회공헌', '봉사활동', '장학금', '기부',
    '스카이트랙스', '고객만족도', '1위 선정', '수상', '인증',
    '드론', '군집비행', '무인기', '방산',
    # Non-flight products & services
    'eSIM', '유심', '와이파이 도시락', '로밍', '렌터카', '카지노', '골프장',
    '스키 시즌권', '숏트립', '카카오페이', '맛집', '숙소', '호텔'
]

# Multi-topic press roundup headings that aggregate unrelated articles
ROUNDUP_TITLE_PREFIXES = [
    '[산업소식]', '[산업 소식]', '[유통소식]', '[유통가]', '[기업소식]', '[기업브리프]',
    '[주간 여행산업', '[TOP\'s Pick]', '[EBN 데이터센터]', '[여행한컷]', '[여행24시]',
    '[뉴스브리핑]', '[브리핑]', '[종합]', '[포토]', '[기획]'
]

# Essential flight/airline keywords: Headline (title) MUST contain at least one of these
TITLE_AIRLINE_OR_FLIGHT_KEYWORDS = [
    # Airlines
    '피치항공', '피치', 'Peach', '집에어', 'ZIPAIR', '일본항공', 'JAL', '전일본공수', 'ANA',
    '대한항공', '아시아나항공', '아시아나', '제주항공', '진에어', '티웨이항공', '티웨이',
    '트리니티항공', '트리니티', '이스타항공', '이스타', '에어부산', '에어서울',
    '에어프레미아', '에어로케이', '파라타항공', '파라타',
    # Flight terms
    '항공권', '비행기표', '비행기', '항공편', '탑승권', '하늘길', '노선', '취항', '운항',
    '항공사', '항공업계', 'LCC', 'FSC', '국제선', '항공'
]

# Non-Japan destination keywords for excluding purely non-Japan headlines
NON_JAPAN_DESTINATIONS = [
    '유럽', '미주', '미국', '하와이', '괌', '사이판', '동남아', '다낭', '나트랑', '푸꾸옥',
    '방콕', '치앙마이', '발리', '대만', '타이베이', '가오슝', '홍콩', '마카오', '중국',
    '칭다오', '상하이', '베이징', '장가계', '선전', '세부', '보라카이', '보홀', '필리핀', '코타키나발루'
]

JAPAN_CITIES = [
    "일본", "한일", "한·일", "한-일", "도쿄", "오사카", "후쿠오카", "삿포로", "오키나와", "나고야",
    "마쓰야마", "시즈오카", "히로시마", "가고시마", "다카마쓰", "타카마츠", "오이타",
    "구마모토", "쿠마모토", "사가", "기타큐슈", "키타큐슈", "요나고", "간사이", "나리타", "하네다",
    "고베", "센다이", "아오모리", "니가타", "아사히카와", "하코다테", "도야마", "미야코지마", "시모지지마",
    "우베", "이바라키", "도쿠시마"
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
    "티웨이항공": ["티웨이", "티웨이항공", "TWAY", "트리니티항공", "트리니티"],
    "이스타항공": ["이스타", "이스타항공", "EASTAR"],
    "에어부산": ["에어부산", "AIR BUSAN"],
    "에어서울": ["에어서울", "AIR SEOUL"],
    "에어프레미아": ["에어프레미아", "AIR PREMIA"],
    "에어로케이": ["에어로케이", "AERO K"],
    "파라타항공": ["파라타항공", "파라타", "PARATA"],
}

GOOGLE_QUERIES = [
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

NAVER_QUERIES = [
    "일본 항공권 특가",
    "일본 항공권 프로모션",
    "제주항공 일본 특가",
    "진에어 일본 특가",
    "티웨이항공 일본 특가",
    "에어서울 일본 특가",
    "이스타항공 일본 특가",
    "에어부산 일본 특가",
    "에어프레미아 일본 특가",
    "피치항공 특가",
    "일본항공 특가",
    "전일본공수 ANA 특가",
    "에어로케이 일본 특가",
]

def clean_news_title(title: str) -> str:
    """Clean news title and strip media suffixes properly without ruining hyphenated city routes."""
    # Only remove newspaper suffix when preceded by space-hyphen-space: e.g. " - 머니투데이"
    t = re.sub(r'\s+-\s+[^\s-]{2,15}$', '', title).strip()
    t = t.replace('&nbsp;', ' ').replace('&quot;', '"').replace('&amp;', '&').replace('&lt;', '<').replace('&gt;', '>')
    t = re.sub(r'새 창 열림', '', t).strip()
    t = re.sub(r'\s+', ' ', t).strip()
    return t

def normalize_title_key(title: str) -> str:
    """Normalize title for fuzzy deduplication across different sources"""
    cleaned = re.sub(r'\[[^\]]*\]', '', title)
    cleaned = re.sub(r'\([^\)]*\)', '', cleaned)
    cleaned = re.sub(r'[^가-힣a-zA-Z0-9]', '', cleaned)
    return cleaned[:20]

def extract_naver_press(profile) -> str:
    if not profile:
        return '언론사'
    img = profile.find('img')
    if img and img.get('alt'):
        alt = img['alt'].replace('의 프로필 이미지', '').replace('프로필 이미지', '').strip()
        if alt:
            return alt
    for s in profile.stripped_strings:
        s = s.strip()
        if s in ('새 창 열림', 'Keep에 저장', 'Keep에 바로가기', '네이버뉴스') or '면' in s or '단' in s:
            continue
        if re.search(r'\d', s):
            continue
        return s
    return '언론사'

def extract_naver_date_str(profile) -> str:
    if not profile:
        return ''
    for s in profile.stripped_strings:
        s_clean = s.strip()
        if re.search(r'(\d+)\s*(초|분|시간|일|주|달|개월|년)\s*전', s_clean):
            return s_clean
        if re.search(r'\d{4}[.-]\d{1,2}[.-]\d{1,2}', s_clean):
            return s_clean
    return ''

def parse_naver_date(date_str: str) -> str:
    now = datetime.now()
    if not date_str:
        return now.strftime('%Y-%m-%d')
    date_str = date_str.strip()
    m_min = re.search(r'(\d+)\s*분\s*전', date_str)
    if m_min:
        return (now - timedelta(minutes=int(m_min.group(1)))).strftime('%Y-%m-%d %H:%M')
    m_hr = re.search(r'(\d+)\s*시간\s*전', date_str)
    if m_hr:
        return (now - timedelta(hours=int(m_hr.group(1)))).strftime('%Y-%m-%d %H:%M')
    m_day = re.search(r'(\d+)\s*일\s*전', date_str)
    if m_day:
        return (now - timedelta(days=int(m_day.group(1)))).strftime('%Y-%m-%d')
    m_week = re.search(r'(\d+)\s*주\s*전', date_str)
    if m_week:
        return (now - timedelta(weeks=int(m_week.group(1)))).strftime('%Y-%m-%d')
    m_month = re.search(r'(\d+)\s*(달|개월)\s*전', date_str)
    if m_month:
        return (now - timedelta(days=int(m_month.group(1)) * 30)).strftime('%Y-%m-%d')
    m_date = re.search(r'(\d{4})[.-](\d{1,2})[.-](\d{1,2})', date_str)
    if m_date:
        return f"{m_date.group(1)}-{int(m_date.group(2)):02d}-{int(m_date.group(3)):02d}"
    return now.strftime('%Y-%m-%d')

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
    clean_t = clean_news_title(title)
    clean_s = summary.strip() if summary else ''
    full_text = f"{clean_t} {clean_s}"

    # 1. Minimum title length check
    if len(clean_t) < 12:
        return False

    # 2. Reject incomplete/truncated titles (dangling comma, dangling quotes, '최...', etc.)
    if clean_t.endswith(',') or clean_t.endswith(",'") or clean_t.endswith('최...') or clean_t.endswith("'인천") or clean_t.endswith('...外'):
        return False

    # 3. Reject omnibus/roundup title prefixes (e.g. [산업소식], [유통가], [기업브리프])
    for pfx in ROUNDUP_TITLE_PREFIXES:
        if clean_t.startswith(pfx):
            return False

    # 4. ESSENTIAL: Title MUST contain at least one airline name or flight keyword
    # Prevents unrelated news like "[산업소식] 삼성전자, ..." from slipping in through summary
    if not any(ak in clean_t for ak in TITLE_AIRLINE_OR_FLIGHT_KEYWORDS):
        return False

    # 5. Reject blacklist keywords in title or summary
    for kw in EXCLUDE_KEYWORDS:
        if kw in full_text:
            return False

    # 6. Strict Japan Relevance check
    # If title specifically mentions non-Japan destinations without any Japan indicator in title, reject!
    has_non_japan_in_title = any(nj in clean_t for nj in NON_JAPAN_DESTINATIONS)
    has_japan_in_title = any(jd in clean_t for jd in JAPAN_CITIES)
    if has_non_japan_in_title and not has_japan_in_title:
        return False

    # Must mention Japan or Japan city in full_text (title or summary)
    if not any(city in full_text for city in JAPAN_CITIES):
        return False

    # 7. Must have promotion keyword in full_text
    if not any(pm in full_text for pm in PROMO_MUST_HAVE):
        return False

    # 8. Strict Date check: dynamic cutoff (past 14 days)
    cutoff_date = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
    if pub_date and pub_date < cutoff_date:
        return False

    return True

def crawl_flight_news() -> List[Dict[str, Any]]:
    print("[NewsCrawler] Starting Japan flight promotion crawl (Naver & Google News)...")
    seen_links = set()
    seen_title_keys = set()
    articles = []

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8',
        'Referer': 'https://www.naver.com/'
    }

    # -------------------------------------------------------------
    # 1. NAVER NEWS CRAWL (Direct Article Links, Priority 1)
    # -------------------------------------------------------------
    print(" -> [1/2] Fetching Naver News articles...")
    for query in NAVER_QUERIES:
        try:
            encoded_query = urllib.parse.quote(query)
            url = f"https://search.naver.com/search.naver?where=news&query={encoded_query}&sm=tab_opt&sort=1"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=8) as resp:
                soup = BeautifulSoup(resp.read().decode('utf-8', errors='ignore'), 'html.parser')
                
                # Support both modern SDS layout and standard layout
                raw_items = soup.select('.fds-news-item-list-tab > div')
                if not raw_items:
                    raw_items = soup.select('.list_news > li')

                for it in raw_items:
                    profile = it.find(attrs={'data-sds-comp': 'Profile'})
                    press = extract_naver_press(profile)
                    date_raw = extract_naver_date_str(profile)
                    if not date_raw:
                        date_el = it.select_one('.info_group span.info')
                        if date_el:
                            date_raw = date_el.text.strip()

                    links = it.find_all('a')
                    art_link, title, desc = '', '', ''
                    for a in links:
                        href = a.get('href', '')
                        text = a.text.strip().replace('새 창 열림', '').strip()
                        if not href or href == '#' or 'keep.naver.com' in href or href.startswith('javascript:'):
                            continue
                        if href.startswith('http') and ('news' in href or 'article' in href or 'view' in href or len(text) > 10):
                            if not title and len(text) > 5:
                                title = text
                                art_link = href
                            elif title and not desc and len(text) > 10 and text != title:
                                desc = text

                    if not title or not art_link or art_link in seen_links:
                        continue

                    clean_title = clean_news_title(title)
                    clean_desc = re.sub(r'새 창 열림', '', desc).strip()

                    t_key = normalize_title_key(clean_title)
                    if t_key and t_key in seen_title_keys:
                        continue

                    pub_date_formatted = parse_naver_date(date_raw)

                    # Strict active Japan promo filter
                    if not is_valid_active_japan_promo(clean_title, clean_desc, pub_date_formatted):
                        continue

                    seen_links.add(art_link)
                    if t_key:
                        seen_title_keys.add(t_key)

                    # Detect mentioned airline
                    detected_airline = "일본 노선 항공사"
                    for air_name, syns in AIRLINE_KEYWORDS.items():
                        if any(s in clean_title for s in syns):
                            detected_airline = air_name
                            break

                    matched_japan_cities = []
                    for city in JAPAN_CITIES:
                        if city in clean_title and city != "일본" and city not in matched_japan_cities:
                            matched_japan_cities.append(city)

                    promo_status, period_desc = detect_promo_status(clean_title, clean_desc, pub_date_formatted)
                    art_id = hashlib.md5(art_link.encode('utf-8')).hexdigest()

                    articles.append({
                        "id": f"news_{art_id}",
                        "title": clean_title,
                        "summary": clean_desc if clean_desc else clean_title,
                        "source": press,
                        "link": art_link,
                        "published_at": pub_date_formatted,
                        "airline": detected_airline,
                        "is_japan": 1,
                        "japan_cities": ", ".join(matched_japan_cities) if matched_japan_cities else "일본 전역",
                        "region_category": "일본",
                        "promo_status": promo_status,
                        "promo_period_desc": period_desc
                    })
            time.sleep(0.3)
        except Exception as e:
            print(f"[NewsCrawler-Naver] Error query '{query}': {e}")

    naver_count = len(articles)
    print(f" -> Naver News collected: {naver_count} valid promotions")

    # -------------------------------------------------------------
    # 2. GOOGLE NEWS RSS CRAWL (Supplementary Coverage)
    # -------------------------------------------------------------
    print(" -> [2/2] Fetching Google News RSS articles...")
    for query in GOOGLE_QUERIES:
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

                    clean_title = clean_news_title(title)
                    clean_summary = re.sub(r'<[^>]+>', '', summary).strip()

                    t_key = normalize_title_key(clean_title)
                    if t_key and t_key in seen_title_keys:
                        continue

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

                    # Strict active Japan promo filter
                    if not is_valid_active_japan_promo(clean_title, clean_summary, pub_date_formatted or ''):
                        continue

                    seen_links.add(link)
                    if t_key:
                        seen_title_keys.add(t_key)

                    detected_airline = "일본 노선 항공사"
                    for air_name, syns in AIRLINE_KEYWORDS.items():
                        if any(s in clean_title for s in syns):
                            detected_airline = air_name
                            break

                    matched_japan_cities = []
                    for city in JAPAN_CITIES:
                        if city in clean_title and city != "일본" and city not in matched_japan_cities:
                            matched_japan_cities.append(city)

                    promo_status, period_desc = detect_promo_status(clean_title, clean_summary, pub_date_formatted or '')
                    art_id = hashlib.md5(link.encode('utf-8')).hexdigest()

                    articles.append({
                        "id": f"news_{art_id}",
                        "title": clean_title,
                        "summary": clean_summary if clean_summary else clean_title,
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
            print(f"[NewsCrawler-Google] Error query '{query}': {e}")

    # Sort: newest first
    articles.sort(key=lambda x: x['published_at'] or '', reverse=True)
    print(f"[NewsCrawler] TOTAL collected: {len(articles)} ACTIVE/UPCOMING Japan promotion articles (Naver: {naver_count}, Google: {len(articles)-naver_count})")
    return articles

if __name__ == '__main__':
    arts = crawl_flight_news()
    for a in arts[:10]:
        print(f"[{a['promo_status']}] [{a['published_at']}] [{a['source']}] {a['title']} ({a['promo_period_desc']})")
        print(f"    URL: {a['link']}")
