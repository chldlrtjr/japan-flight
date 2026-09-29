import re
from typing import Tuple, List, Optional

# Japan destination mapping
JAPAN_DESTINATIONS = {
    "도쿄": ["도쿄", "나리타", "하네다"],
    "오사카": ["오사카", "간사이"],
    "후쿠오카": ["후쿠오카", "기타큐슈", "사가", "오이타", "구마모토"],
    "삿포로": ["삿포로", "신치토세", "홋카이도", "아사히카와"],
    "오키나와": ["오키나와", "나하"],
    "나고야": ["나고야", "주부"],
    "소도시/온천": ["마쓰야마", "시즈오카", "히로시마", "가고시마", "다카마쓰", "요나고", "도쿠시마", "고베", "미야자키"]
}

ALL_JAPAN_KEYWORDS = [
    "일본", "도쿄", "오사카", "후쿠오카", "삿포로", "오키나와", "나고야",
    "마쓰야마", "시즈오카", "히로시마", "가고시마", "다카마쓰", "오이타",
    "구마모토", "사가", "기타큐슈", "요나고", "도쿠시마", "고베", "간사이",
    "나리타", "하네다", "신치토세", "홋카이도", "피치항공", "Peach", "ZIPAIR", "집에어", "JAL", "ANA",
    "제트스타", "Jetstar", "스카이마크", "Skymark", "스타플라이어", "StarFlyer", "에어도", "AIRDO", "에어두",
    "솔라시드", "Solaseed", "후지드림", "Fuji Dream", "FDA", "아이벡스", "IBEX", "스프링재팬", "Spring Japan",
    "일본트랜스오션", "JTA", "류큐에어", "RAC", "아마쿠사", "AMX", "오리엔탈에어", "ORC", "홋카이도에어", "HAC", "토키에어", "Toki Air",
    "대한항공", "KAL", "아시아나항공", "아시아나", "AAR", "제주항공", "진에어", "티웨이", "이스타",
    "에어서울", "에어부산", "에어프레미아", "에어로케이", "파라타항공"
]

def is_japan_promo(text: str) -> bool:
    for kw in ALL_JAPAN_KEYWORDS:
        if kw in text:
            return True
    return False

def analyze_japan_promotion(title: str, subtitle: str = "", content: str = "") -> Tuple[bool, str, str]:
    """
    Returns:
        (is_japan: bool,
         japan_city_category: "도쿄" | "오사카" | "후쿠오카" | "삿포로" | "오키나와" | "소도시/온천" | "일본 전역",
         destinations: "도쿄, 오사카")
    """
    full_text = f"{title} {subtitle} {content}".strip()
    
    if not is_japan_promo(full_text):
        return False, "기타", ""

    matched_categories = []
    matched_cities = []

    for cat, cities in JAPAN_DESTINATIONS.items():
        for city in cities:
            if city in full_text:
                if cat not in matched_categories:
                    matched_categories.append(cat)
                if city not in matched_cities:
                    matched_cities.append(city)

    dest_str = ", ".join(matched_cities) if matched_cities else "일본 전역"
    best_cat = matched_categories[0] if len(matched_categories) == 1 else ("일본 전역" if len(matched_categories) > 1 else "일본 전역")

    return True, best_cat, dest_str

def extract_dates(text: str) -> Tuple[Optional[str], Optional[str]]:
    patterns = [
        r'(\d{4})[.\-/](\d{2})[.\-/](\d{2})\s*~\s*(\d{4})[.\-/](\d{2})[.\-/](\d{2})',
        r'(\d{2})[.\-/](\d{2})\s*~\s*(\d{2})[.\-/](\d{2})'
    ]
    for pat in patterns:
        m = re.search(pat, text)
        if m:
            groups = m.groups()
            if len(groups) == 6:
                start_date = f"{groups[0]}-{groups[1]}-{groups[2]}"
                end_date = f"{groups[3]}-{groups[4]}-{groups[5]}"
                return start_date, end_date
    return None, None

# Backwards compatibility alias
analyze_promotion = analyze_japan_promotion
