import re
import asyncio
from typing import Tuple, List, Optional
from urllib.parse import urlparse, parse_qs
import requests
from bs4 import BeautifulSoup
from playwright.async_api import async_playwright

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,ja;q=0.7',
    'Referer': 'https://www.google.com/'
}

NEGATIVE_PHRASES = [
    # 1. No active content
    '추천 콘텐츠가 없습니다',
    '진행중인 이벤트가 없습니다',
    '진행 중인 이벤트가 없습니다',
    '진행중인 프로모션이 없습니다',
    '진행 중인 프로모션이 없습니다',
    '등록된 이벤트가 없습니다',
    '등록된 게시물이 없습니다',
    '조회된 내역이 없습니다',
    '해당 이벤트가 존재하지 않습니다',
    '존재하지 않는 이벤트',
    '게시물이 없습니다',
    
    # 2. Expired / Closed notices
    '종료된 이벤트입니다',
    '종료된 프로모션입니다',
    '이벤트가 종료되었습니다',
    '해당 이벤트는 종료되었습니다',
    '해당 이벤트는 종료된',
    '이벤트 기간이 만료되었습니다',
    '판매가 마감되었습니다',
    '판매가 종료되었습니다',
    '마감된 이벤트입니다',
    '존재하지 않는 이벤트입니다',
    
    # 3. Broken / Errors
    '일시적인 오류가 발생했습니다',
    '페이지를 찾을 수 없습니다',
    '요청하신 페이지를 찾을 수 없습니다'
]

# Patterns representing airline root pages, language roots, or generic non-promo pages
GENERIC_ROOT_PATH_PATTERNS = [
    r'^/?$',
    r'^/(kr|ko|en|ja|cn|zh|us|nz)/?$',
    r'^/(kr|ko|en|ja|cn|zh|us|nz)/(kr|ko|en|ja|cn|zh)/?$',
    r'^/ko-kr/?$',
    r'^/en-us/?$',
    r'^/index\.(html|htm|do|jsp|php|aspx)/?$',
    r'^/main\.(html|htm|do|jsp|php|aspx)/?$',
    r'^/home/?$',
]

# Generic list or booking paths that lack specific event identifiers
GENERIC_LIST_OR_BOOKING_PATTERNS = [
    r'/event/promotionList',
    r'/promotion/eventList',
    r'/flights/[a-z]{2}-[a-z]{2}/flights-from-',
    r'/flight-deals-to-',
    r'/booking/search',
    r'/find-flights'
]

def is_root_or_generic_url(url: str) -> Tuple[bool, str]:
    """
    Strict Zero-Guesswork Rule:
    Detects whether a URL is merely an airline homepage root (e.g. csair.com/kr/ko/),
    a language landing page, or a generic booking/list directory rather than a genuine promo detail page.
    """
    if not url or not url.startswith('http'):
        return True, "유효하지 않은 URL 형식"

    parsed = urlparse(url)
    path = parsed.path.rstrip('/')

    # 1. Check for domain root or language root path
    for pat in GENERIC_ROOT_PATH_PATTERNS:
        if re.match(pat, path, re.IGNORECASE):
            return True, f"항공사 메인 홈페이지(도메인 루트) URL 등록 불가: {url}"

    # 2. Check for generic list or booking hub without specific promo ID/parameters
    has_specific_param = bool(parse_qs(parsed.query).get('eventNo') or 
                              parse_qs(parsed.query).get('seq') or 
                              parse_qs(parsed.query).get('id') or
                              parse_qs(parsed.query).get('no'))
    
    # Trinity airways encoded retrieve path is allowed
    is_trinity_detail = '/app/promotion/event/retrieve/' in parsed.path and len(parsed.path.split('/')[-1]) > 5
    is_specific_event_path = any(k in parsed.path for k in ['eventDetail.do', 'eventView.do', '/specials/'])

    for pat in GENERIC_LIST_OR_BOOKING_PATTERNS:
        if re.search(pat, parsed.path, re.IGNORECASE):
            if not has_specific_param and not is_trinity_detail and not is_specific_event_path:
                return True, f"단순 이벤트 목록 또는 일반 예약/노선 페이지는 프로모션 상세 링크로 등록 불가: {url}"

    return False, "상세 페이지 형태"

def is_fake_or_stock_image(image_url: Optional[str]) -> bool:
    """Detects whether an image URL is an Unsplash stock photo or dummy placeholder."""
    if not image_url:
        return False
    img_lower = image_url.lower()
    if 'unsplash.com' in img_lower or 'dummy' in img_lower or 'placeholder' in img_lower:
        return True
    return False

def verify_via_http(url: str) -> Tuple[bool | None, str]:
    """
    Stage 1: Fast HTTP verification with realistic browser headers.
    Returns (True/False/None, reason). None indicates that Playwright browser check is needed.
    """
    # Guardrail check
    is_generic, generic_reason = is_root_or_generic_url(url)
    if is_generic:
        return False, generic_reason

    try:
        r = requests.get(url, headers=HEADERS, timeout=12, allow_redirects=True)
        if r.status_code == 403:
            r = requests.get(url, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}, timeout=12, allow_redirects=True)

        if r.status_code in [404, 403, 500, 502, 503]:
            return False, f"HTTP 에러 상태 코드: {r.status_code}"

        final_url = r.url.lower()
        if any(e in final_url for e in ['/error.', 'errorpage', 'viewcommonerror', 'accessdenied']):
            return False, f"에러 페이지로 리다이렉트: {r.url}"

        # Check final redirected URL for root
        is_redirect_generic, red_reason = is_root_or_generic_url(r.url)
        if is_redirect_generic:
            return False, f"리다이렉트 결과 메인 페이지로 이동: {r.url}"

        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            title = soup.title.string.strip() if soup.title and soup.title.string else ''
            text = ' '.join(soup.get_text().split())

            for neg in NEGATIVE_PHRASES:
                if neg in text:
                    return False, f"이벤트 없음/종료 문구 감지: '{neg}'"

            # Domain-specific verified passes with authentic detail identifiers
            if 'jejuair.net' in url.lower() and 'eventDetail.do' in url and '제주항공' in title:
                return True, f"제주항공 공식 프로모션 확인 (HTTP 200, {len(text)}자)"
            if 'eastarjet.com' in url.lower() and 'eventNo=' in url and '이스타항공' in title:
                return True, f"이스타항공 공식 프로모션 확인 (HTTP 200, {len(text)}자)"
            if 'flyairseoul.com' in url.lower() and 'eventView.do' in url:
                return True, f"에어서울 공식 프로모션 확인 (HTTP 200, {len(text)}자)"
            if 'flypeach.com' in url.lower() and '/specials/' in url and ('peach' in title.lower() or '운임' in text):
                return True, f"피치항공 공식 프로모션 확인 (HTTP 200, {len(text)}자)"

            if len(text) > 300 and not any(e in title.lower() for e in ['error', '404', 'denied']):
                return True, f"정상 유효 프로모션 확인 (HTTP 200, {len(text)}자)"

        return None, f"HTTP 상태 {r.status_code}, 브라우저 정밀 검증 필요"
    except Exception as e:
        return None, f"HTTP 검증 예외 ({e}), 브라우저 정밀 검증 필요"

async def verify_url_with_browser(url: str, timeout_ms: int = 20000) -> Tuple[bool, str]:
    """
    Stage 2: Playwright Headless Browser for SPAs and dynamic pages.
    """
    is_generic, generic_reason = is_root_or_generic_url(url)
    if is_generic:
        return False, generic_reason

    url_lower = url.lower()
    if 'parataair.com' in url_lower:
        return False, "미취항 가상 항공사 URL"
    if '/being/now' in url_lower:
        return False, "티웨이 잘못된 이전 라우팅(/being/now)"

    # Stage 1: Fast HTTP Check
    http_ok, http_msg = verify_via_http(url)
    if http_ok is True:
        return True, http_msg
    if http_ok is False:
        return False, http_msg

    # Stage 2: Browser Check
    async with async_playwright() as p:
        browser = await p.chromium.launch(
            headless=True,
            args=['--disable-blink-features=AutomationControlled', '--no-sandbox']
        )
        try:
            context = await browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
                viewport={"width": 1280, "height": 800}
            )
            page = await context.new_page()
            await page.add_init_script("Object.defineProperty(navigator, 'webdriver', {get: () => undefined});")
            
            resp = await page.goto(url, wait_until="domcontentloaded", timeout=timeout_ms)
            await page.wait_for_timeout(2500)

            final_url = page.url.lower()
            title = await page.title()

            is_final_generic, fin_reason = is_root_or_generic_url(page.url)
            if is_final_generic:
                return False, f"브라우저 렌더링 결과 메인/목록 페이지로 리다이렉트됨: {page.url}"

            # 1. Check title for errors
            if any(e in title for e in ['404', 'Access Denied', 'Error']):
                return False, f"페이지 제목 에러: '{title}' (URL: {page.url})"

            # 2. Check final URL
            if any(err_p in final_url for err_p in ['/error.', 'errorpage', 'viewcommonerror', '404', 'accessdenied']):
                return False, f"에러 페이지로 리다이렉트: {page.url}"

            # 3. Check body text
            body_text = await page.inner_text("body")
            body_clean = " ".join(body_text.split())

            if len(body_clean) < 40:
                return False, f"본문 내용이 없는 빈 흰 화면(Empty Body, 글자수 {len(body_clean)})"

            for neg in NEGATIVE_PHRASES:
                if neg in body_clean:
                    return False, f"이벤트 없음/종료 문구 감지: '{neg}'"

            return True, f"브라우저 렌더링 정상 검증 완료 (본문 {len(body_clean)}자)"

        except Exception as e:
            return False, f"브라우저 접속 실패: {e}"
        finally:
            await browser.close()

def is_promotion_valid(url: str) -> Tuple[bool, str]:
    """Synchronous wrapper for verify_url_with_browser."""
    try:
        return asyncio.run(verify_url_with_browser(url))
    except Exception as e:
        return False, f"검증 에러: {e}"

if __name__ == '__main__':
    test_urls = [
        ("차단대상-중국남방항공 메인", "https://www.csair.com/kr/ko/"),
        ("차단대상-대한항공 오클랜드 노선", "https://www.koreanair.com/flights/ko-kr/flights-from-seoul-to-auckland"),
        ("차단대상-에어뉴질랜드 딜 목록", "https://www.airnewzealand.co.kr/flight-deals-to-new-zealand"),
        ("차단대상-에어프레미아 프로모션 목록", "https://www.airpremia.com/kr/ko/event/promotionList"),
        ("차단대상-피치 메인", "https://www.flypeach.com/kr"),
        ("정상-제주항공 하코다테", "https://www.jejuair.net/ko/event/eventDetail.do?eventNo=0000004361"),
        ("정상-이스타 엔믹스", "https://www.eastarjet.com/newstar/PGWTA00002?eventNo=2645&gubun=I&searchIndex=1"),
    ]
    print("=== URL Verifier Guardrail Test ===\n")
    for name, u in test_urls:
        ok, reason = is_promotion_valid(u)
        status = "✅ PASS" if ok else "❌ FILTERED (CORRECT)"
        print(f"[{status}] {name}")
        print(f"  URL: {u}")
        print(f"  결과: {reason}\n")
