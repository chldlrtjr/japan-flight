import requests
import hashlib
import html
import os
import re
import time
from datetime import datetime, timedelta
from email.utils import parsedate_to_datetime
from urllib.parse import urlparse
from typing import List, Dict, Any, Optional
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
    # Reward App Quizzes (NOT airline promos)
    '캐시워크', '돈버는퀴즈', '오퀴즈', '퀴즈 정답', '정답 공개', '캐시닥', '타임스프레드',
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
    '에어뉴질랜드', '에어 뉴질랜드', 'Air New Zealand', '중국남방항공',
    # Flight terms
    '항공권', '비행기표', '비행기', '항공편', '탑승권', '하늘길', '노선', '취항', '운항',
    '항공사', '항공업계', 'LCC', 'FSC', '국제선', '항공'
]

# Non-target destination keywords for excluding purely unrelated headlines
NON_TARGET_DESTINATIONS = [
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

NZ_CITIES = [
    "뉴질랜드", "오클랜드", "크라이스트처치", "퀸스타운", "웰링턴", "남섬", "북섬"
]

AIRLINE_KEYWORDS = {
    "에어뉴질랜드": ["에어뉴질랜드", "에어 뉴질랜드", "AIR NEW ZEALAND", "ANZ"],
    "대한항공": ["대한항공", "KOREAN AIR", "KAL"],
    "중국남방항공": ["중국남방항공", "남방항공", "CHINA SOUTHERN"],
    "피치항공": ["피치", "피치항공", "PEACH"],
    "집에어": ["집에어", "ZIPAIR"],
    "일본항공": ["일본항공", "JAL"],
    "전일본공수": ["전일본공수", "ANA"],
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

NAVER_QUERIES = [
    "일본 항공권 특가",
    "일본 항공권 프로모션",
    "일본 항공권 세일",
    "제주항공 일본 특가",
    "진에어 일본 특가",
    "티웨이항공 일본 특가",
    "트리니티항공 일본 특가",
    "에어서울 일본 특가",
    "이스타항공 일본 특가",
    "에어부산 일본 특가",
    "에어프레미아 일본 특가",
    "피치항공 특가",
    "일본항공 특가",
    "뉴질랜드 항공권 특가",
    "에어뉴질랜드 특가",
    "오클랜드 항공권 특가",
    "뉴질랜드 항공권 프로모션",
    "대한항공 오클랜드 특가"
]

def clean_news_title(title: str) -> str:
    """Clean news title and strip media suffixes properly without ruining hyphenated city routes."""
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

def parse_naver_date_robust(date_raw: str, link_url: str = '') -> Optional[str]:
    """
    Parses publication date accurately from raw date text or article link URL.
    CRITICAL: Never fall back to 'today' if date is missing/unknown!
    Returns None if date cannot be determined reliably.
    """
    now = datetime.now()
    if date_raw:
        clean = date_raw.strip()
        m_min = re.search(r'(\d+)\s*분\s*전', clean)
        if m_min:
            return (now - timedelta(minutes=int(m_min.group(1)))).strftime('%Y-%m-%d')
        m_hour = re.search(r'(\d+)\s*시간\s*전', clean)
        if m_hour:
            return (now - timedelta(hours=int(m_hour.group(1)))).strftime('%Y-%m-%d')
        m_day = re.search(r'(\d+)\s*일\s*전', clean)
        if m_day:
            return (now - timedelta(days=int(m_day.group(1)))).strftime('%Y-%m-%d')
        m_week = re.search(r'(\d+)\s*주\s*전', clean)
        if m_week:
            return (now - timedelta(weeks=int(m_week.group(1)))).strftime('%Y-%m-%d')
        m_month = re.search(r'(\d+)\s*(?:달|개월)\s*전', clean)
        if m_month:
            return (now - timedelta(days=int(m_month.group(1)) * 30)).strftime('%Y-%m-%d')
        m_date = re.search(r'(\d{4})[.-](\d{1,2})[.-](\d{1,2})', clean)
        if m_date:
            y, m, d = m_date.groups()
            return f"{int(y):04d}-{int(m):02d}-{int(d):02d}"

    # Try link URL date pattern: e.g. 20261021, 2026-10-21, 2026/10/21
    if link_url:
        m_url = re.search(r'(202[4-9])[/-]?([01]\d)[/-]?([0-3]\d)', link_url)
        if m_url:
            y, mo, da = m_url.groups()
            if 1 <= int(mo) <= 12 and 1 <= int(da) <= 31:
                return f"{int(y):04d}-{int(mo):02d}-{int(da):02d}"

    # DO NOT GUESS OR DEFAULT TO TODAY!
    return None

def detect_promo_status(title: str, summary: str, pub_date_str: str) -> tuple:
    """Detect promotion status (ACTIVE vs UPCOMING) and target travel period description."""
    text = f"{title} {summary}"
    status = "ACTIVE"
    if any(k in text for k in ['오픈 예정', '예정', '출시 예정', '개시 예정', '앞두고', '사전 예약', '얼리버드 오픈']):
        status = "UPCOMING"

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

def is_valid_active_promo(title: str, summary: str, pub_date: Optional[str]) -> bool:
    clean_t = clean_news_title(title)
    clean_s = summary.strip() if summary else ''
    full_text = f"{clean_t} {clean_s}"

    # 1. Minimum title length check
    if len(clean_t) < 12:
        return False

    # 2. Reject incomplete/truncated titles
    if clean_t.endswith(',') or clean_t.endswith(",'") or clean_t.endswith('최...') or clean_t.endswith("'인천") or clean_t.endswith('...外'):
        return False

    # 3. Reject omnibus/roundup title prefixes
    for pfx in ROUNDUP_TITLE_PREFIXES:
        if clean_t.startswith(pfx):
            return False

    # 4. ESSENTIAL: Title MUST contain at least one airline name or flight keyword
    if not any(ak in clean_t for ak in TITLE_AIRLINE_OR_FLIGHT_KEYWORDS):
        return False

    # 5. Reject blacklist keywords in title or summary
    for kw in EXCLUDE_KEYWORDS:
        if kw in full_text:
            return False

    # 6. Target Relevance check (Japan or New Zealand)
    has_target_in_title = any(jd in clean_t for jd in JAPAN_CITIES) or any(nz in clean_t for nz in NZ_CITIES)
    has_non_target_in_title = any(nj in clean_t for nj in NON_TARGET_DESTINATIONS)
    if has_non_target_in_title and not has_target_in_title:
        return False

    has_japan_or_nz = any(city in full_text for city in JAPAN_CITIES) or any(city in full_text for city in NZ_CITIES)
    if not has_japan_or_nz:
        return False

    # 7. Must have promotion keyword in full_text
    if not any(pm in full_text for pm in PROMO_MUST_HAVE):
        return False

    # 8. Strict Date check: Date MUST be verified and strictly within past 14 days
    if not pub_date:
        return False

    cutoff_date = (datetime.now() - timedelta(days=14)).strftime("%Y-%m-%d")
    if pub_date < cutoff_date:
        return False

    return True

# Backwards compatibility alias
is_valid_active_japan_promo = is_valid_active_promo

NAVER_NEWS_API_URL = "https://naverapihub.apigw.ntruss.com/search/v1/news"

def _naver_api_keys() -> tuple:
    # notifier loads the project .env into os.environ on import
    from . import notifier  # noqa: F401
    return os.getenv("NAVER_API_KEY_ID", "").strip(), os.getenv("NAVER_API_KEY", "").strip()

def _strip_api_markup(text: str) -> str:
    return html.unescape(re.sub(r'</?b>', '', text or '')).strip()

def _fetch_api_items(session: requests.Session, query: str, key_id: str, key: str):
    """Yields (title, desc, link, pub_date, press) from NAVER API HUB news search."""
    resp = session.get(
        NAVER_NEWS_API_URL,
        params={"query": query, "display": 100, "sort": "date", "format": "json"},
        headers={"X-NCP-APIGW-API-KEY-ID": key_id, "X-NCP-APIGW-API-KEY": key},
        timeout=10,
    )
    if resp.status_code != 200:
        print(f"[NewsCrawler-API] Query '{query}' HTTP status {resp.status_code}: {resp.text[:200]}")
        return
    for it in resp.json().get("items", []):
        link = it.get("originallink") or it.get("link") or ''
        try:
            pub_date = parsedate_to_datetime(it["pubDate"]).strftime('%Y-%m-%d')
        except (KeyError, TypeError, ValueError):
            pub_date = None
        # The API carries no press name; resolved later only for accepted articles
        yield _strip_api_markup(it.get("title")), _strip_api_markup(it.get("description")), link, pub_date, None

def _fetch_html_items(session: requests.Session, query: str):
    """Fallback when API keys are absent: parses Naver search result HTML."""
    url = f"https://search.naver.com/search.naver?where=news&query={requests.utils.quote(query)}&sm=tab_opt&sort=1"
    resp = session.get(url, timeout=10)
    if resp.status_code != 200:
        print(f"[NewsCrawler-Naver] Query '{query}' HTTP status {resp.status_code}")
        return

    soup = BeautifulSoup(resp.text, 'html.parser')

    # Select news item containers (supports new SDS and legacy markup)
    raw_items = soup.select('.fds-news-item-list-tab > div')
    if not raw_items:
        raw_items = soup.select('.list_news > li')

    for it in raw_items:
        # 1. Extract Press source
        press = '언론사'
        source_tag = it.select_one('.sds-comps-profile img')
        if source_tag and source_tag.get('alt'):
            press = source_tag['alt'].replace('의 프로필 이미지', '').replace('프로필 이미지', '').strip()
        if not press or press == '언론사':
            source_a = it.select_one('.sds-comps-profile-source a, .info_group a.press')
            if source_a:
                press = source_a.text.strip().replace('새 창 열림', '').strip()

        # 2. Extract Title, Description, and Link
        title, art_link, desc = '', '', ''
        for a in it.find_all('a'):
            href = a.get('href', '')
            txt = a.text.strip().replace('새 창 열림', '').strip()
            if not href or href == '#' or 'keep.naver.com' in href or href.startswith('javascript:'):
                continue
            # Prioritize article links
            is_article_href = any(k in href for k in ['article', 'view', 'idxno', 'nid', 'news'])
            if href.startswith('http') and (is_article_href or len(txt) > 10):
                if not title and len(txt) > 8:
                    title = txt
                    art_link = href
                elif title and not desc and len(txt) > 12 and txt != title:
                    desc = txt

        if not title or not art_link:
            continue

        # 3. Extract Raw Date string
        date_raw = ''
        date_el = it.select_one('.sds-comps-profile-info-subtexts, .sds-comps-profile-info-subtext, .info_group span.info')
        if date_el:
            date_raw = date_el.text.strip()
        else:
            for s in it.stripped_strings:
                s_str = s.strip()
                if re.search(r'(\d+)\s*(초|분|시간|일|주|달|개월)\s*전', s_str) or re.search(r'\d{4}[.-]\d{1,2}[.-]\d{1,2}', s_str):
                    date_raw = s_str
                    break

        yield title, re.sub(r'새 창 열림', '', desc).strip(), art_link, parse_naver_date_robust(date_raw, art_link), press

def _resolve_press_name(session: requests.Session, link: str, cache: Dict[str, str]) -> str:
    """Reads the publisher's own og:site_name; falls back to the bare hostname."""
    host = urlparse(link).netloc.lower().removeprefix('www.')
    if host in cache:
        return cache[host]
    name = host or '언론사'
    try:
        resp = session.get(link, timeout=6)
        if resp.status_code == 200:
            if not resp.encoding or resp.encoding.lower() == 'iso-8859-1':
                resp.encoding = resp.apparent_encoding
            meta = BeautifulSoup(resp.text, 'html.parser').select_one('meta[property="og:site_name"]')
            site = (meta.get('content') or '').strip() if meta else ''
            if 1 < len(site) <= 30:
                name = site
    except Exception:
        pass
    cache[host] = name
    return name

def crawl_flight_news() -> List[Dict[str, Any]]:
    print("[NewsCrawler] Starting flight promotion crawl (Japan & New Zealand Deals)...")
    seen_links = set()
    seen_title_keys = set()
    press_cache: Dict[str, str] = {}
    articles = []

    headers = {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
        'Referer': 'https://search.naver.com/'
    }

    session = requests.Session()
    session.headers.update(headers)

    key_id, key = _naver_api_keys()
    use_api = bool(key_id and key)
    print(f" -> Fetching Naver News articles via {'NAVER API HUB' if use_api else 'search HTML (no API keys)'}...")
    for query in NAVER_QUERIES:
        try:
            items = _fetch_api_items(session, query, key_id, key) if use_api else _fetch_html_items(session, query)
            for title, clean_desc, art_link, pub_date_formatted, press in items:
                if not title or not art_link or art_link in seen_links:
                    continue

                clean_title = clean_news_title(title)

                t_key = normalize_title_key(clean_title)
                if t_key and t_key in seen_title_keys:
                    continue

                # Strict active promo filter (rejects unknown date or > 14 days old)
                if not is_valid_active_promo(clean_title, clean_desc, pub_date_formatted):
                    continue

                seen_links.add(art_link)
                if t_key:
                    seen_title_keys.add(t_key)

                if not press:
                    press = _resolve_press_name(session, art_link, press_cache)

                # Detect region (New Zealand vs Japan)
                # Title decides first; the summary is only consulted when the title names neither region
                title_nz = any(c in clean_title for c in NZ_CITIES)
                title_jp = any(c in clean_title for c in JAPAN_CITIES)
                if title_nz or title_jp:
                    is_nz = title_nz
                else:
                    is_nz = any(c in clean_desc for c in NZ_CITIES) and not any(c in clean_desc for c in JAPAN_CITIES)
                if is_nz:
                    region_category = "뉴질랜드"
                    is_japan = 0
                    matched_cities = [c for c in NZ_CITIES if c in clean_title and c not in ["뉴질랜드", "남섬", "북섬"]]
                    dest_str = ", ".join(matched_cities) if matched_cities else "뉴질랜드 전역"
                    default_airline = "뉴질랜드 노선 항공사"
                else:
                    region_category = "일본"
                    is_japan = 1
                    matched_cities = [c for c in JAPAN_CITIES if c in clean_title and c != "일본"]
                    dest_str = ", ".join(matched_cities) if matched_cities else "일본 전역"
                    default_airline = "일본 노선 항공사"

                detected_airline = default_airline
                for air_name, syns in AIRLINE_KEYWORDS.items():
                    if any(s in clean_title for s in syns):
                        detected_airline = air_name
                        break

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
                    "is_japan": is_japan,
                    "japan_cities": dest_str,
                    "region_category": region_category,
                    "promo_status": promo_status,
                    "promo_period_desc": period_desc
                })
            time.sleep(0.3)
        except Exception as e:
            print(f"[NewsCrawler-Naver] Error query '{query}': {e}")

    # Sort: newest first
    articles.sort(key=lambda x: x['published_at'] or '', reverse=True)
    print(f"[NewsCrawler] TOTAL collected: {len(articles)} ACTIVE/UPCOMING promotion articles from Naver News")
    return articles

if __name__ == '__main__':
    arts = crawl_flight_news()
    for a in arts[:10]:
        print(f"[{a['promo_status']}] [{a['published_at']}] [{a['source']}] {a['title']} ({a['promo_period_desc']})")
        print(f"    URL: {a['link']}")
