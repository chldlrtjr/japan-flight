import sys
import os
import time
import argparse
from datetime import datetime

# Add root folder to sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from crawler.runner import run_all_crawlers

def start_scheduler(interval_seconds: int = 3600, run_immediately: bool = True):
    """
    Runs the flight promotion crawler periodically at the specified interval.
    Default interval is 1 hour (3600 seconds).
    """
    print("=" * 60)
    print(f"✈️ [Flight Deal Crawler] 자동 스케줄러 시작")
    print(f"⏰ 실행 주기: {interval_seconds}초 ({interval_seconds / 60:.1f}분 / {interval_seconds / 3600:.2f}시간)")
    print(f"🛑 종료하려면 Ctrl + C 를 누르세요.")
    print("=" * 60)

    run_count = 0

    if not run_immediately:
        print(f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {interval_seconds}초 후 첫 번째 크롤링이 시작됩니다...")
        time.sleep(interval_seconds)

    while True:
        run_count += 1
        start_time = datetime.now()
        print(f"\n============================================================")
        print(f"🚀 [회차 #{run_count}] 크롤링 작업 시작: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
        print(f"============================================================")

        try:
            summary = run_all_crawlers()
            duration = (datetime.now() - start_time).total_seconds()
            print(f"\n✅ [회차 #{run_count}] 크롤링 완료 (소요 시간: {duration:.1f}초)")
            print(f"   - 총 특가 수: {summary.get('db_total', 0)}건 (국제선: {summary.get('db_international', 0)}건)")
            print(f"   - 총 뉴스 기사: {summary.get('db_news_total', 0)}건 (일본 특가: {summary.get('db_news_japan', 0)}건)")
        except Exception as e:
            print(f"\n❌ [회차 #{run_count}] 크롤링 중 오류 발생: {e}")

        next_run = datetime.now().timestamp() + interval_seconds
        next_run_str = datetime.fromtimestamp(next_run).strftime('%Y-%m-%d %H:%M:%S')
        print(f"\n⏳ 다음 크롤링 예정 시각: {next_run_str} ({interval_seconds / 60:.0f}분 후)")
        print(f"============================================================")

        try:
            time.sleep(interval_seconds)
        except KeyboardInterrupt:
            print("\n👋 스케줄러가 사용자에 의해 안전하게 종료되었습니다.")
            break

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="항공권 특가 1시간 주기 자동 크롤러")
    parser.add_argument(
        "--interval",
        type=int,
        default=3600,
        help="크롤링 실행 주기(초). 기본값: 3600초 (1시간)"
    )
    parser.add_argument(
        "--no-immediate",
        action="store_true",
        help="시작 시 즉시 실행하지 않고 다음 주기부터 실행"
    )
    args = parser.parse_args()

    start_scheduler(interval_seconds=args.interval, run_immediately=not args.no_immediate)
