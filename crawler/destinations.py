import re
from typing import Tuple, List, Optional

# Japan destination mapping - 한국 출발 직항/운항 일본 전 도시
JAPAN_DESTINATIONS = {
    "도쿄": ["도쿄", "나리타", "하네다"],
    "오사카": ["오사카", "간사이"],
    "후쿠오카": ["후쿠오카"],
    "삿포로": ["삿포로", "신치토세", "치토세", "홋카이도"],
    "나고야": ["나고야", "주부", "센트레아"],
    "오키나와": ["오키나와", "나하"],
    "마쓰야마": ["마쓰야마"],
    "다카마쓰": ["다카마쓰", "타카마츠"],
    "히로시마": ["히로시마"],
    "시즈오카": ["시즈오카"],
    "기타큐슈": ["기타큐슈", "키타큐슈"],
    "구마모토": ["구마모토", "쿠마모토"],
    "가고시마": ["가고시마"],
    "오이타": ["오이타"],
    "사가": ["사가"],
    "나가사키": ["나가사키"],
    "미야자키": ["미야자키"],
    "요나고": ["요나고", "돗토리"],
    "오카야마": ["오카야마"],
    "고마쓰": ["고마쓰", "가나자와", "고마츠"],
    "센다이": ["센다이"],
    "아오모리": ["아오모리"],
    "니가타": ["니가타"],
    "도쿠시마": ["도쿠시마"],
    "아사히카와": ["아사히카와"],
    "하코다테": ["하코다테"],
    "도야마": ["도야마", "토야마"],
    "고베": ["고베"],
    "미야코지마": ["미야코지마", "시모지지마"],
    "우베": ["우베", "야마구치"],
    "이바라키": ["이바라키"],
}

ALL_JAPAN_KEYWORDS = [
    "일본", "도쿄", "오사카", "후쿠오카", "삿포로", "오키나와", "나고야",
    "마쓰야마", "시즈오카", "히로시마", "가고시마", "다카마쓰", "타카마츠", "오이타",
    "구마모토", "쿠마모토", "사가", "기타큐슈", "키타큐슈", "요나고", "도쿠시마", "고베", "간사이",
    "나리타", "하네다", "신치토세", "치토세", "홋카이도", "미야자키", "오카야마",
    "센다이", "아오모리", "고마쓰", "가나자와", "니가타", "아사히카와",
    "하코다테", "도야마", "미야코지마", "시모지지마", "우베", "이바라키",
    "피치항공", "Peach", "ZIPAIR", "집에어", "JAL", "일본항공", "ANA", "전일본공수"
]

def is_japan_promo(text: str) -> bool:
    text_lower = text.lower()
    for kw in ALL_JAPAN_KEYWORDS:
        if kw.lower() in text_lower:
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
