import os
import sys
import json
import html
import requests
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

# Personal round-trip fare watcher -> Telegram.
# The itinerary comes from the FLIGHT_WATCH_CONFIG env (GitHub Secret) because this repo and
# its Actions logs are public: never print dates, routes or prices to stdout.
#
# FLIGHT_WATCH_CONFIG = {
#   "origin": "ICN", "dest": "CHC",
#   "out_date": "2027-01-09", "ret_date": "2027-02-06",
#   "arrive_on": "2027-01-10",        (optional: keep only itineraries landing on this date)
#   "target_price": 1300000            (KRW, round trip, 1 adult)
# }

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

STATE_PATH = os.getenv("FLIGHT_WATCH_STATE", os.path.join(os.path.dirname(__file__), "..", ".flight_watch_state.json"))
KST = timezone(timedelta(hours=9))
FAIL_ALERT_AFTER = 3

def _fmt_dt(d: str) -> str:
    # "2027-01-09 21:30" -> "01/09 21:30"
    return f"{d[5:7]}/{d[8:10]} {d[11:16]}"

def fetch_fast_flights(cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    from fast_flights import create_query, FlightQuery, Passengers, get_flights
    q = create_query(
        flights=[
            FlightQuery(date=cfg["out_date"], from_airport=cfg["origin"], to_airport=cfg["dest"]),
            FlightQuery(date=cfg["ret_date"], from_airport=cfg["dest"], to_airport=cfg["origin"]),
        ],
        trip="round-trip", seat="economy", passengers=Passengers(adults=1),
        language="ko", currency="KRW",
    )
    results = []
    for f in get_flights(q):
        legs = [{
            "from": s.from_airport.code,
            "to": s.to_airport.code,
            "dep": "%04d-%02d-%02d %02d:%02d" % (*s.departure.date, *s.departure.time),
            "arr": "%04d-%02d-%02d %02d:%02d" % (*s.arrival.date, *s.arrival.time),
        } for s in f.flights]
        results.append({"source": "Google 항공편 (fast-flights)", "price": int(f.price),
                        "airlines": ", ".join(f.airlines), "legs": legs})
    return results

def fetch_serpapi(cfg: Dict[str, Any]) -> List[Dict[str, Any]]:
    key = os.getenv("SERPAPI_KEY", "").strip()
    if not key:
        return []
    r = requests.get("https://serpapi.com/search.json", params={
        "engine": "google_flights", "type": 1,
        "departure_id": cfg["origin"], "arrival_id": cfg["dest"],
        "outbound_date": cfg["out_date"], "return_date": cfg["ret_date"],
        "currency": "KRW", "hl": "ko", "gl": "kr", "api_key": key,
    }, timeout=60)
    r.raise_for_status()
    data = r.json()
    results = []
    for opt in data.get("best_flights", []) + data.get("other_flights", []):
        if not opt.get("price"):
            continue
        legs = [{
            "from": s["departure_airport"]["id"], "to": s["arrival_airport"]["id"],
            "dep": s["departure_airport"]["time"], "arr": s["arrival_airport"]["time"],
        } for s in opt.get("flights", [])]
        airlines = ", ".join(dict.fromkeys(s.get("airline", "") for s in opt.get("flights", [])))
        results.append({"source": "Google 항공편 (SerpApi)", "price": int(opt["price"]),
                        "airlines": airlines, "legs": legs})
    return results

def links(cfg: Dict[str, Any]) -> str:
    o, d = cfg["origin"], cfg["dest"]
    out_s = cfg["out_date"].replace("-", "")[2:]
    ret_s = cfg["ret_date"].replace("-", "")[2:]
    google = (f"https://www.google.com/travel/flights?q=Flights%20from%20{o}%20to%20{d}"
              f"%20on%20{cfg['out_date']}%20returning%20{cfg['ret_date']}&curr=KRW&hl=ko")
    sky = f"https://www.skyscanner.co.kr/transport/flights/{o.lower()}/{d.lower()}/{out_s}/{ret_s}/"
    return f'<a href="{google}">Google 항공편</a> · <a href="{sky}">스카이스캐너</a>'

def format_offer(o: Dict[str, Any]) -> str:
    route = " → ".join([o["legs"][0]["from"]] + [l["to"] for l in o["legs"]]) if o["legs"] else ""
    first, last = (o["legs"][0], o["legs"][-1]) if o["legs"] else ({}, {})
    times = f"{_fmt_dt(first['dep'])} 출발 · {_fmt_dt(last['arr'])} 도착" if o["legs"] else ""
    return (f"<b>₩{o['price']:,}</b> (왕복 1인)\n"
            f"{html.escape(o['airlines'])}\n{route}\n{times}\n"
            f"<i>{html.escape(o['source'])}</i>")

def load_state() -> Dict[str, Any]:
    try:
        with open(STATE_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    except (FileNotFoundError, json.JSONDecodeError):
        return {}

def save_state(state: Dict[str, Any]):
    with open(STATE_PATH, "w", encoding="utf-8") as f:
        json.dump(state, f)

def run() -> int:
    from crawler.notifier import send_telegram_message

    cfg = json.loads(os.environ["FLIGHT_WATCH_CONFIG"])
    target = int(cfg.get("target_price", 0))
    if datetime.now(KST).strftime("%Y-%m-%d") >= cfg["out_date"]:
        print("[FlightWatch] departure date reached; watch finished")
        return 0
    state = load_state()

    offers: List[Dict[str, Any]] = []
    ok_sources = 0
    for name, fn in (("serpapi", fetch_serpapi), ("fast_flights", fetch_fast_flights)):
        try:
            got = fn(cfg)
            offers += got
            ok_sources += 1 if got else 0
            print(f"[FlightWatch] {name}: {len(got)} offers")
        except ImportError as e:
            print(f"[FlightWatch] {name}: failed (missing module {e.name})")
        except Exception as e:
            print(f"[FlightWatch] {name}: failed ({type(e).__name__})")

    arrive_on = cfg.get("arrive_on")
    if arrive_on:
        offers = [o for o in offers if o["legs"] and o["legs"][-1]["arr"][:10] == arrive_on]

    if not offers:
        state["fail_count"] = state.get("fail_count", 0) + 1
        print(f"[FlightWatch] no usable offers (consecutive: {state['fail_count']})")
        if state["fail_count"] == FAIL_ALERT_AFTER:
            send_telegram_message(
                f"<b>[항공권 감시] 조회 실패 {FAIL_ALERT_AFTER}회 연속</b>\n"
                f"가격 소스가 차단됐거나 조건에 맞는 항공편이 없습니다.\n{links(cfg)}")
        save_state(state)
        return 0

    state["fail_count"] = 0
    best = min(offers, key=lambda o: o["price"])
    lowest = state.get("lowest")
    now = datetime.now(KST).strftime("%Y-%m-%d %H:%M")

    if lowest is None or best["price"] < lowest:
        if lowest is None:
            head = "<b>[항공권 감시 시작]</b> 현재 최저가"
        elif target and best["price"] <= target:
            head = f"<b>[목표가 달성]</b> ₩{target:,} 이하 · 이전 최저 ₩{lowest:,}"
        else:
            head = f"<b>[최저가 갱신]</b> 이전 최저 ₩{lowest:,}"
        sent = send_telegram_message(f"{head}\n\n{format_offer(best)}\n\n{links(cfg)}")
        state["lowest"] = best["price"]
        state["lowest_at"] = now
        print(f"[FlightWatch] new lowest recorded; alert sent: {sent}")
    else:
        print("[FlightWatch] no new lowest")

    state["last_checked"] = now
    save_state(state)
    return 0

if __name__ == "__main__":
    sys.exit(run())
