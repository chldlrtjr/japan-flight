import os
import sys
import argparse
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from crawler.expire_checker import check_and_expire_promotions
from crawler.db import get_connection, export_data_to_json

def main():
    parser = argparse.ArgumentParser(description="종료된 일본 항공권 특가 및 뉴스 검사 후 내리기/마감 처리")
    parser.add_argument("--live", action="store_true", help="웹 링크(detail_url) 접속하여 종료 여부 추가 검사")
    parser.add_argument("--purge", action="store_true", help="종료된 특가를 status='END' 대신 DB에서 영구 삭제")
    parser.add_argument("--date", type=str, default=None, help="기준 일자 (YYYY-MM-DD, 기본값: 오늘)")

    args = parser.parse_args()

    today_str = args.date or datetime.now().strftime("%Y-%m-%d")
    print(f"\n==========================================")
    print(f"✈️ [JapanFlight] 종료 특가 검사 및 내리기 시작")
    print(f"   기준 일자: {today_str}")
    print(f"   웹페이지 실시간 검사: {'활성화' if args.live else '비활성화'}")
    print(f"   영구 삭제 모드: {'활성화' if args.purge else '종료(END) 마킹'}")
    print(f"==========================================\n")

    if args.purge:
        conn = get_connection()
        cur = conn.cursor()
        cur.execute("SELECT id, airline, title, promo_end FROM promotions WHERE promo_end < ?", (today_str,))
        expired = cur.fetchall()
        print(f"🗑️ 만료된 {len(expired)}건을 데이터베이스에서 영구 삭제합니다:")
        for r in expired:
            print(f"   - [{r['airline']}] {r['title']} (만료일: {r['promo_end']})")
        cur.execute("DELETE FROM promotions WHERE promo_end < ?", (today_str,))
        cur.execute("DELETE FROM news_articles WHERE promo_end < ?", (today_str,))
        conn.commit()
        conn.close()
        export_data_to_json()
        print("\n✅ 삭제 및 최신 JSON 파일 반영 완료!")
    else:
        result = check_and_expire_promotions(today_str=today_str, check_live=args.live)
        print("\n✅ 종료 특가 확인 및 내리기 완료!")
        print(f"   - 신규 종료 처리된 특가: {result['newly_expired_count']}건")
        print(f"   - 현재 진행 중인 특가: {result['active_promos_count']}건")
        print(f"   - 종료된 특가: {result['ended_promos_count']}건")

if __name__ == '__main__':
    main()
