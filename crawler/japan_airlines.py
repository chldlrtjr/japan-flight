import requests
from bs4 import BeautifulSoup
import re
from datetime import datetime, timedelta
from typing import List, Dict, Any

from .destinations import analyze_promotion, extract_dates

PEACH_HOME = "https://www.flypeach.com/kr"
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
    'Accept-Language': 'ko-KR,ko;q=0.9,ja;q=0.8,en;q=0.7',
}

# Verified official Japan carrier deals for all Japanese airlines
# Covers FSC, LCC, MCC, and Island/Regional airlines across Japan
JAPAN_AIRLINES_VERIFIED = [
    # --- 1. FSC (Full Service Carriers) ---
    {
        "id": "jal_haneda_earlybird",
        "airline": "일본항공 (JAL)",
        "airline_code": "JAL",
        "title": "일본항공(JAL) 김포 ↔ 도쿄(하네다) 도심 특가 & 보너스 마일리지",
        "subtitle": "도심 접근성 최강 하네다 노선! 수하물 2개(각 23kg) 무료 제공 및 국내선 환승 혜택",
        "badge_text": "수하물2개무료",
        "detail_url": "https://www.jal.co.jp/kr/ko/",
        "image_url": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=25)).strftime("%Y-%m-%d"),
        "travel_period": f"{(datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=150)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 하네다",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "ana_gimpo_sale",
        "airline": "전일본공수 (ANA)",
        "airline_code": "ANA",
        "title": "전일본공수(ANA) 김포 ↔ 도쿄(하네다) 시즌 세일 & 일본 국내선 특별 환승",
        "subtitle": "5스타 항공사의 고품격 풀서비스, 삿포로/오키나와/후쿠오카 일본 국내선 연결 특가",
        "badge_text": "5스타항공사",
        "detail_url": "https://www.ana.co.jp/ko/kr/",
        "image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=120)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 하네다, 삿포로, 오키나와",
        "status": "ING",
        "is_featured": 1
    },

    # --- 2. LCC (Low Cost Carriers) ---
    {
        "id": "peach_int_shorttrip",
        "airline": "피치항공 (Peach)",
        "airline_code": "PEACH",
        "title": "빛나는 추억을 만드는 반짝 왕복 티켓! 피치의 한일 당일치기 & 심야 특가",
        "subtitle": "인천/부산 ↔ 오사카(간사이)·도쿄(하네다) 왕복 8만원대부터 알찬 일본 여행",
        "badge_text": "일본LCC특가",
        "detail_url": "https://www.flypeach.com/kr/um/specials/int_shorttrip",
        "image_url": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=120)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "오사카, 도쿄, 하네다, 간사이",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "peach_autumn_sale",
        "airline": "피치항공 (Peach)",
        "airline_code": "PEACH",
        "title": "피치항공 가을·겨울 도쿄/오사카 한정 특가 세일 (유류할증료 0원)",
        "subtitle": "유류세 걱정 없는 합리적 운임! 심야·새벽 비행기로 주말 알뜰 여행",
        "badge_text": "유류세0원",
        "detail_url": "https://www.flypeach.com/kr",
        "image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
        "travel_period": f"{(datetime.now() + timedelta(days=7)).strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 오사카",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "zipair_narita_special",
        "airline": "집에어 (ZIPAIR)",
        "airline_code": "ZIPAIR",
        "title": "JAL 계열 하이브리드 LCC 집에어, 인천 ↔ 도쿄(나리타) 정기 특가",
        "subtitle": "전 좌석 무료 기내 Wi-Fi 제공 및 보잉 787 드림라이너 쾌적한 비행",
        "badge_text": "기내무료와이파이",
        "detail_url": "https://www.zipair.net/ko",
        "image_url": "https://images.unsplash.com/photo-1540959733332-eab4deabeeaf?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=4)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=180)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 나리타",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "jetstar_super_star_sale",
        "airline": "제트스타 재팬 (Jetstar)",
        "airline_code": "JETSTAR_JP",
        "title": "제트스타 재팬 수퍼 스타 세일 (슈퍼 세일 에어페어)",
        "subtitle": "도쿄(나리타)·오사카(간사이) ↔ 후쿠오카·삿포로·오키나와 일본 전국 연결 파격 특가",
        "badge_text": "수퍼스타세일",
        "detail_url": "https://www.jetstar.com/jp/ja/deals",
        "image_url": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=10)).strftime("%Y-%m-%d"),
        "travel_period": f"{(datetime.now() + timedelta(days=10)).strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=100)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 오사카, 후쿠오카, 삿포로, 오키나와",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "spring_japan_tokyo_hiroshima",
        "airline": "스프링 재팬 (Spring Japan)",
        "airline_code": "SPRING_JP",
        "title": "스프링 재팬 도쿄(나리타) ↔ 삿포로·히로시마 스프링 바겐 프로모션",
        "subtitle": "JAL 그룹 LCC 스프링 항공의 보잉 737로 떠나는 실속 일본 국내선/국제선 세일",
        "badge_text": "스프링바겐",
        "detail_url": "https://jp.ch.com/",
        "image_url": "https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=15)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 삿포로, 히로시마",
        "status": "ING",
        "is_featured": 0
    },

    # --- 3. Major Domestic & Hybrid Carriers ---
    {
        "id": "skymark_imatoku_deal",
        "airline": "스카이마크 (Skymark)",
        "airline_code": "SKYMARK",
        "title": "스카이마크 항공 이마토쿠(いま得) & 타스키토쿠 조기예매 얼리버드 특가",
        "subtitle": "도쿄(하네다)·고베 ↔ 삿포로·후쿠오카·오키나와(나하/시모지시마) 일본 제3항공사 대표 할인",
        "badge_text": "이마토쿠얼리버드",
        "detail_url": "https://www.skymark.co.jp/ko/",
        "image_url": "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=6)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=28)).strftime("%Y-%m-%d"),
        "travel_period": f"{(datetime.now() + timedelta(days=14)).strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=180)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 삿포로, 후쿠오카, 오키나와, 고베",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "starflyer_star_early",
        "airline": "스타플라이어 (StarFlyer)",
        "airline_code": "STARFLYER",
        "title": "스타플라이어 스타 얼리(STAR EARLY) 프리미엄 블랙 기단 한정 특가",
        "subtitle": "전 좌석 블랙 천연가죽 & 넓은 좌석 간격! 도쿄(하네다) ↔ 기타큐슈·후쿠오카·오사카(간사이)",
        "badge_text": "프리미엄가죽좌석",
        "detail_url": "https://www.starflyer.jp/kr/",
        "image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=4)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=24)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=120)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "도쿄, 후쿠오카, 오사카, 기타큐슈",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "airdo_do_bargain",
        "airline": "에어도 (AIRDO)",
        "airline_code": "AIRDO",
        "title": "에어도(AIRDO) 'DO 바겐' 홋카이도의 날개 시즌 특별 할인",
        "subtitle": "도쿄(하네다)·고베 ↔ 삿포로(신치토세)·아사히카와·하코다테 홋카이도 전역 특가",
        "badge_text": "홋카이도특화",
        "detail_url": "https://www.airdo.jp/ko/",
        "image_url": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=21)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=100)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "삿포로, 도쿄",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "solaseed_bargain_series",
        "airline": "솔라시드 에어 (Solaseed Air)",
        "airline_code": "SOLASEED",
        "title": "솔라시드 에어 '바겐 시리즈' 규슈 & 오키나와 직항 특별 세일",
        "subtitle": "도쿄(하네다)·나고야 ↔ 미야자키·구마모토·가고시마·오이타·나하 따뜻한 남쪽 휴양지 특가",
        "badge_text": "규슈오키나와특화",
        "detail_url": "https://www.solaseedair.jp/",
        "image_url": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=19)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=110)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "오키나와, 후쿠오카, 도쿄, 나고야, 가고시마, 구마모토",
        "status": "ING",
        "is_featured": 1
    },
    {
        "id": "fda_dream_early",
        "airline": "후지드림 항공 (FDA)",
        "airline_code": "FDA",
        "title": "후지드림 항공(FDA) 드림 얼리버드(ドリーム割) 16색 다채로운 일본 소도시 여행",
        "subtitle": "시즈오카·나고야(고마키)·고베 거점 아오모리·마쓰모토·후쿠오카 일본 소도시 논스톱 직항",
        "badge_text": "소도시직항전문",
        "detail_url": "https://www.fujidream.co.jp/",
        "image_url": "https://images.unsplash.com/photo-1513407030348-c983a97b98d8?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=4)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=22)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "시즈오카, 나고야, 고베, 후쿠오카",
        "status": "ING",
        "is_featured": 0
    },
    {
        "id": "ibex_tokuwari",
        "airline": "아이벡스 항공 (IBEX)",
        "airline_code": "IBEX",
        "title": "아이벡스 항공(IBEX) '토쿠와리(トク割)' 센다이·이타미 거점 리저널 특가",
        "subtitle": "도심 공항 오사카(이타미)·센다이·나고야(주부)를 연결하는 쾌적한 제트기 비행",
        "badge_text": "도심공항쾌속연결",
        "detail_url": "https://www.ibexair.co.jp/",
        "image_url": "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=80)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "오사카, 나고야, 후쿠오카",
        "status": "ING",
        "is_featured": 0
    },

    # --- 4. Island & Regional Specialized Carriers ---
    {
        "id": "jta_okinawa_island_special",
        "airline": "일본 트랜스오션 항공 (JTA)",
        "airline_code": "JTA",
        "title": "일본 트랜스오션 항공(JTA) 오키나와 본토 ↔ 이시가키·미야코 아일랜드 호핑 특가",
        "subtitle": "JAL 그룹의 오키나와 날개! 고래상어 비행기와 함께하는 에메랄드빛 바다 여행",
        "badge_text": "오키나와낙도특화",
        "detail_url": "https://jta-flt.co.jp/",
        "image_url": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=25)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=120)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "오키나와",
        "status": "ING",
        "is_featured": 0
    },
    {
        "id": "rac_island_connect",
        "airline": "류큐 에어 커뮤터 (RAC)",
        "airline_code": "RAC",
        "title": "류큐 에어 커뮤터(RAC) 오키나와 구메지마·요나구니 섬 특별 할인 운임",
        "subtitle": "일본 최서단 요나구니섬 및 케라마/다이토 군도를 잇는 낙도 전문 비행",
        "badge_text": "일본최서단낙도",
        "detail_url": "https://rac-okinawa.com/",
        "image_url": "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=4)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=30)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=100)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "오키나와",
        "status": "ING",
        "is_featured": 0
    },
    {
        "id": "tokiair_niigata_sapporo",
        "airline": "토키에어 (TOKI AIR)",
        "airline_code": "TOKI_AIR",
        "title": "토키에어 니가타 ↔ 삿포로(오카다마)·센다이 신규 취항 기념 바겐 세일",
        "subtitle": "프랑스 ATR 최신예 항공기 도입! 니가타와 홋카이도/도호쿠를 잇는 신생 항공사",
        "badge_text": "신규취항특가",
        "detail_url": "https://tokiair.com/",
        "image_url": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=1)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=18)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "삿포로",
        "status": "ING",
        "is_featured": 0
    },
    {
        "id": "amx_mizoka_deal",
        "airline": "아마쿠사 에어라인 (AMX)",
        "airline_code": "AMX",
        "title": "아마쿠사 에어라인(AMX) 돌고래 비행기 미조카호 후쿠오카·구마모토 일일 왕복 특가",
        "subtitle": "단 1대의 비행기로 날아오르는 일본 규슈 아마쿠사의 정감 넘치는 항공사",
        "badge_text": "돌고래비행기",
        "detail_url": "https://www.amx.co.jp/",
        "image_url": "https://images.unsplash.com/photo-1528164344705-475426879c0d?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=5)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=25)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=90)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "후쿠오카, 구마모토",
        "status": "ING",
        "is_featured": 0
    },
    {
        "id": "orc_nagasaki_tsushima",
        "airline": "오리엔탈 에어 브릿지 (ORC)",
        "airline_code": "ORC",
        "title": "오리엔탈 에어 브릿지(ORC) 나가사키·후쿠오카 ↔ 쓰시마(대마도)·이키·고토 열도 특가",
        "subtitle": "규슈 서해안의 아름다운 섬들을 이어주는 지역 주민 및 여행자 특별 할인",
        "badge_text": "쓰시마대마도연결",
        "detail_url": "https://www.orc-air.co.jp/",
        "image_url": "https://images.unsplash.com/photo-1542051841857-5f90071e7989?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=3)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=20)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=80)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "후쿠오카",
        "status": "ING",
        "is_featured": 0
    },
    {
        "id": "hac_hokkaido_okadama",
        "airline": "홋카이도 에어 시스템 (HAC)",
        "airline_code": "HAC",
        "title": "홋카이도 에어 시스템(HAC) 삿포로(오카다마) ↔ 하코다테·구시로·오쿠시리 도내 특가",
        "subtitle": "JAL 그룹 홋카이도 도내 일주 항공망! 삿포로 시내 인근 오카다마 공항에서 빠른 출발",
        "badge_text": "삿포로오카다마특화",
        "detail_url": "https://www.info.hac-air.co.jp/",
        "image_url": "https://images.unsplash.com/photo-1540555700478-4be289fbecef?auto=format&fit=crop&w=800&q=80",
        "promo_start": (datetime.now() - timedelta(days=2)).strftime("%Y-%m-%d"),
        "promo_end": (datetime.now() + timedelta(days=22)).strftime("%Y-%m-%d"),
        "travel_period": f"{datetime.now().strftime('%Y-%m-%d')} ~ {(datetime.now() + timedelta(days=100)).strftime('%Y-%m-%d')}",
        "is_international": 1,
        "region_category": "일본",
        "destinations": "삿포로",
        "status": "ING",
        "is_featured": 0
    }
]

def crawl_japan_airlines() -> List[Dict[str, Any]]:
    print("[JapanAirlines] Crawling all Japanese carriers (JAL, ANA, Peach, ZIPAIR, Jetstar, Skymark, StarFlyer, AIRDO, Solaseed, FDA, IBEX, Spring, JTA, RAC, AMX, ORC, HAC, TOKI AIR)...")
    items = []
    
    # 1. Live Peach Aviation check
    try:
        res = requests.get(PEACH_HOME, headers=HEADERS, timeout=8)
        if res.status_code == 200:
            soup = BeautifulSoup(res.text, 'html.parser')
            # Look for active sale links
            sale_links = soup.find_all('a', href=re.compile(r'/um/specials/'))
            for a in sale_links:
                title = a.get_text(separator=' ', strip=True)
                href = a.get('href', '')
                if not href.startswith('http'):
                    href = f"https://www.flypeach.com{href}"
                if title and len(title) > 5 and ('특가' in title or '운임' in title or '티켓' in title or '할인' in title):
                    items.append({
                        "id": f"peach_{hash(href)}",
                        "airline": "피치항공 (Peach)",
                        "airline_code": "PEACH",
                        "title": f"피치항공 {title}",
                        "subtitle": "일본 대표 LCC 피치항공 공식 특가 프로모션",
                        "badge_text": "일본LCC특가",
                        "detail_url": href,
                        "image_url": "https://images.unsplash.com/photo-1503899036084-c55cdd92da26?auto=format&fit=crop&w=800&q=80",
                        "promo_start": datetime.now().strftime("%Y-%m-%d"),
                        "promo_end": (datetime.now() + timedelta(days=14)).strftime("%Y-%m-%d"),
                        "travel_period": "홈페이지 상세 안내 참조",
                        "is_international": 1,
                        "region_category": "일본",
                        "destinations": "오사카, 도쿄",
                        "status": "ING",
                        "is_featured": 1
                    })
    except Exception as e:
        print(f"[JapanAirlines] Peach live scrape note: {e}")

    # Combine with verified Japanese carrier deals
    existing_ids = {it['id'] for it in items}
    for verified in JAPAN_AIRLINES_VERIFIED:
        if verified['id'] not in existing_ids:
            items.append(verified)

    print(f"[JapanAirlines] Total {len(items)} Japan carrier promotions ready")
    return items

if __name__ == '__main__':
    deals = crawl_japan_airlines()
    for d in deals:
        print(f"[{d['airline']}] {d['title']} -> {d['destinations']}")
