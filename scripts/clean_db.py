import sqlite3
import os
import sys
sys.path.insert(0, os.path.abspath("."))
from crawler.destinations import is_supported_promo
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

# 3. Delete non-target items (empty dests and neither Japan nor NZ)
cursor.execute("""
    DELETE FROM promotions 
    WHERE (destinations IS NULL OR destinations = '') 
      AND title NOT LIKE '%일본%' 
      AND title NOT LIKE '%뉴질랜드%'
      AND title NOT LIKE '%오클랜드%'
""")
cursor.execute("DELETE FROM promotions WHERE title LIKE '%면세점%' OR title LIKE '%박물관%' OR title LIKE '%신한카드%' OR title LIKE '%멤버스%' OR title LIKE '%포인트%'")

# 4. Zero-Guesswork: Delete all fake/mock promotions, root domain URLs, generic list URLs, and Unsplash stock images
cursor.execute("""
    DELETE FROM promotions
    WHERE id IN (
        'csair_akl_guangzhou_transit_deal',
        'koreanair_akl_direct_2026',
        'airnz_nz_all_deals_2026',
        'airpremia_sapporo_inauguration',
        'airbusan_october_coupon',
        'airseoul_october_hurry',
        'airseoul_takamatsu_10th',
        'jin_october_newmember_baggage'
    )
    OR image_url LIKE '%unsplash.com%'
    OR detail_url LIKE '%csair.com/kr/ko%'
    OR detail_url LIKE '%/promotionList%'
    OR detail_url LIKE '%flights-from-seoul-to-auckland%'
    OR detail_url LIKE '%flight-deals-to-new-zealand%'
    OR detail_url = 'https://www.csair.com/kr/ko/'
    OR detail_url = 'https://www.jinair.com/promotion/eventList'
""")

conn.commit()
conn.close()

export_data_to_json()
print("Clean DB script executed successfully.")
