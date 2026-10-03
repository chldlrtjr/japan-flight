import sqlite3
import os
import sys
sys.path.insert(0, os.path.abspath("."))
from crawler.destinations import is_japan_promo
from crawler.db import DB_PATH, export_data_to_json

conn = sqlite3.connect(DB_PATH)
cursor = conn.cursor()

# 1. Delete jin_guam_superlow and any promo with '괌'
cursor.execute("DELETE FROM promotions WHERE id = 'jin_guam_superlow' OR title LIKE '%괌%' OR destinations LIKE '%괌%'")

# 2. Delete pure Japan domestic-only airlines and routes
cursor.execute("""
    DELETE FROM promotions
    WHERE airline_code IN (
        'SKYMARK', 'STARFLYER', 'AIRDO', 'SOLASEED', 'FDA', 'IBEX', 
        'SPRING_JP', 'JETSTAR_JP', 'JTA', 'RAC', 'TOKI_AIR', 'AMX', 'ORC', 'HAC'
    )
    OR id IN (
        'skymark_imatoku_deal', 'starflyer_star_early', 'airdo_do_bargain',
        'solaseed_bargain_series', 'fda_dream_early', 'ibex_tokuwari',
        'jta_okinawa_island_special', 'rac_island_connect', 'tokiair_niigata_sapporo',
        'amx_mizoka_deal', 'orc_nagasaki_tsushima', 'hac_hokkaido_okadama',
        'spring_japan_tokyo_hiroshima', 'jetstar_super_star_sale'
    )
    OR airline LIKE '%스카이마크%'
    OR airline LIKE '%스타플라이어%'
    OR airline LIKE '%에어도%'
    OR airline LIKE '%솔라시드%'
    OR airline LIKE '%후지드림%'
    OR airline LIKE '%아이벡스%'
    OR airline LIKE '%제트스타%'
    OR airline LIKE '%스프링%'
    OR airline LIKE '%트랜스오션%'
    OR airline LIKE '%류큐%'
    OR airline LIKE '%토키%'
    OR airline LIKE '%아마쿠사%'
    OR airline LIKE '%오리엔탈%'
    OR airline LIKE '%홋카이도 에어%'
""")

# 3. Delete non-Japan items (empty dests and no japan in title)
cursor.execute("DELETE FROM promotions WHERE (destinations IS NULL OR destinations = '') AND title NOT LIKE '%일본%'")
cursor.execute("DELETE FROM promotions WHERE title LIKE '%면세점%' OR title LIKE '%박물관%' OR title LIKE '%신한카드%' OR title LIKE '%멤버스%' OR title LIKE '%포인트%'")

# 3. Clean any non-Japan destinations if mixed
cursor.execute("""
UPDATE promotions 
SET destinations = '도쿄, 오사카, 후쿠오카, 삿포로, 오키나와'
WHERE id = 'jin_jinmarket_autumn'
""")

# 4. Insert or update Jin Air Sapporo & Okinawa deal
cursor.execute("""
INSERT OR REPLACE INTO promotions (
    id, airline, airline_code, title, subtitle, badge_text, detail_url, image_url,
    promo_start, promo_end, travel_period, is_international, region_category, destinations,
    status, is_featured, created_at, updated_at
) VALUES (
    'jin_sapporo_okinawa_sale', '진에어', 'JIN',
    '진에어 인천/부산 ↔ 삿포로·오키나와 설경 & 휴양 특가 프로모션',
    '겨울 홋카이도 설경부터 따뜻한 오키나와까지 전 노선 특가 운임',
    '일본특가', 'https://www.jinair.com/promotion/eventList',
    'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=800&q=80',
    '2026-09-25', '2026-10-15', '2026-10-01 ~ 2026-12-31', 1, '일본', '삿포로, 오키나와',
    'ING', 1, datetime('now'), datetime('now')
)
""")

conn.commit()
conn.close()

export_data_to_json()
print("Successfully cleaned database and exported to JSON!")
