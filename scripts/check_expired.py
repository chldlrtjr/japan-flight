import os
import sys
import argparse
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))
from crawler.expire_checker import check_and_expire_promotions

def main():
    parser = argparse.ArgumentParser(description="종료된 일본 항공권 특가 및 뉴스 검사 후 즉시 완전 삭제")
    parser.add_argument("--live", action="store_true", help="웹 링크(detail_url) 접속하여 종료 여부 추가 검사")
    parser.add_argument("--date", type=str, default=None, help="기준 일자 (YYYY-MM-DD, 기본값: 오늘)")

    args = parser.parse_args()

    today_str = args.date or datetime.now().strftime("%Y-%m-%d")
    print(f"\n==========================================")
    print(f"✈️ [JapanFlight] 종료 특가 검사 및 즉시 완전 삭제 시작")
    print(f"   기준 일자: {today_str}")
    print(f"   웹페이지 실시간 검사: {'활성화' if args.live else '비활성화'}")
    print(f"==========================================\n")

    result = check_and_expire_promotions(today_str=today_str, check_live=args.live)
    print("\n✅ 종료 특가 확인 및 데이터베이스 영구 삭제 완료!")
    print(f"   - 삭제된 종료 특가: {result['deleted_promos_count']}건")
    print(f"   - 삭제된 종료 기사: {result['deleted_news_count']}건")
    print(f"   - 현재 진행 중인 특가: {result['remaining_promos']}건")
    print(f"   - 최신 뉴스 기사: {result['remaining_news']}건")

if __name__ == '__main__':
    main()
