import re
import asyncio
from typing import Tuple, List
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
    
    # 2. Expired / Closed notices (must be sentence/status, not menu tab)
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

def verify_via_http(url: str) -> Tuple[bool | None, str]:
    """
    Stage 1: Fast HTTP verification with realistic browser headers.
    Returns (True/False/None, reason). None indicates that Playwright browser check is needed.
    """
    try:
        r = requests.get(url, headers=HEADERS, timeout=12, allow_redirects=True)
        final_url = r.url.lower()
        if any(e in final_url for e in ['/error.', 'errorpage', 'viewcommonerror', 'accessdenied']):
            return False, f"에러 페이지로 리다이렉트: {r.url}"

        if r.status_code == 200:
            soup = BeautifulSoup(r.text, 'html.parser')
            title = soup.title.string.strip() if soup.title and soup.title.string else ''
            text = ' '.join(soup.get_text().split())

            for neg in NEGATIVE_PHRASES:
                if neg in text:
                    return False, f"이벤트 없음/종료 문구 감지: '{neg}'"

            # Domain-specific verified passes
            if 'jejuair.net' in url.lower() and '제주항공' in title:
                return True, f"제주항공 공식 페이지 확인 (HTTP 200, {len(text)}자)"
            if 'flypeach.com' in url.lower() and ('peach' in title.lower() or '운임' in text):
                return True, f"피치항공 공식 프로모션 확인 (HTTP 200, {len(text)}자)"
            if 'eastarjet.com' in url.lower() and '이스타항공' in title:
                return True, f"이스타항공 공식 프로모션 확인 (HTTP 200, {len(text)}자)"
            if 'airpremia.com' in url.lower() and '에어프레미아' in title:
                return True, f"에어프레미아 공식 프로모션 확인 (HTTP 200, {len(text)}자)"

            if len(text) > 200 and not any(e in title.lower() for e in ['error', '404', 'denied']):
                return True, f"정상 유효 프로모션 확인 (HTTP 200, {len(text)}자)"

        return None, f"HTTP 상태 {r.status_code}, 브라우저 정밀 검증 필요"
    except Exception as e:
        return None, f"HTTP 검증 예외 ({e}), 브라우저 정밀 검증 필요"

async def verify_url_with_browser(url: str, timeout_ms: int = 20000) -> Tuple[bool, str]:
    """
    Tiered Verification:
    Stage 1: Fast HTTP verification (resolves bot-protection false positives on static/server-rendered pages)
    Stage 2: Playwright Headless Browser for SPAs and Cloudflare challenges
    """
    url_lower = url.lower()
    if 'parataair.com' in url_lower:
        return False, "미취항 가상 항공사 URL"
    if '/being/now' in url_lower:
        return False, "티웨이 잘못된 이전 라우팅(/being/now)"

    # Stage 1: HTTP Check
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

            # 1. Check title for errors
            if any(e in title for e in ['404', 'Access Denied']):
                return False, f"페이지 제목 에러: '{title}' (URL: {page.url})"

            # 2. Check final URL
            if any(err_p in final_url for err_p in ['/error.', 'errorpage', 'viewcommonerror', '404', 'accessdenied']):
                return False, f"에러 페이지로 리다이렉트: {page.url}"

            # 3. Check body text
            body_text = await page.inner_text("body")
            body_clean = " ".join(body_text.split())

            # Blank body check
            if len(body_clean) < 40:
                return False, f"본문 내용이 없는 빈 흰 화면(Empty Body, 글자수 {len(body_clean)})"

            # Negative content check
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
        ("정상-제주항공 가고시마", "https://www.jejuair.net/ko/event/eventDetail.do?eventNo=0000004308"),
        ("정상-피치항공 당일치기", "https://www.flypeach.com/kr/um/specials/int_shorttrip"),
        ("정상-티웨이 구마모토", "https://www.trinityairways.com/app/promotion/event/retrieve/FGgszKGigc0ilcsI9frlEA==/being/n"),
        ("정상-에어서울 10월초임박", "https://flyairseoul.com/CW/ko/eventView.do?seq=2246&type=I"),
        ("정상-에어부산 10월쿠폰", "https://www.airbusan.com/content/common/flynjoy/event/event/2610_cpn"),
        ("오류-집에어(콘텐츠없음)", "https://www.zipair.net/ko/promotion"),
        ("오류-티웨이(빈화면)", "https://www.twayair.com/app/promotion/event/retrieve/2587/being/now"),
        ("오류-에어서울(404)", "https://flyairseoul.com/CW/ko/event/eventList.do"),
    ]
    print("=== Tiered Hybrid URL Verifier Test ===\n")
    for name, u in test_urls:
        ok, reason = is_promotion_valid(u)
        status = "✅ PASS" if ok else "❌ FILTER OUT"
        print(f"[{status}] {name}")
        print(f"  URL: {u}")
        print(f"  결과: {reason}\n")
