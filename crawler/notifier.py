import os
import requests
from typing import Dict, Any, Optional

def load_env_file():
    """Reads .env from project root if it exists without requiring python-dotenv."""
    project_root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    env_path = os.path.join(project_root, ".env")
    if os.path.exists(env_path):
        with open(env_path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                key, val = line.split("=", 1)
                key = key.strip()
                val = val.strip().strip('"').strip("'")
                if key and key not in os.environ:
                    os.environ[key] = val

# Load .env when module is imported
load_env_file()

def get_telegram_config():
    token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
    chat_id = os.getenv("TELEGRAM_CHAT_ID", "").strip()
    return token, chat_id

def send_telegram_message(message: str, parse_mode: str = "HTML") -> bool:
    """Sends a text message via Telegram Bot API."""
    token, chat_id = get_telegram_config()
    if not token or not chat_id:
        print("[Notifier] Telegram token or chat_id is missing. Notification skipped.")
        return False

    url = f"https://api.telegram.org/bot{token}/sendMessage"
    payload = {
        "chat_id": chat_id,
        "text": message,
        "parse_mode": parse_mode,
        "disable_web_page_preview": False
    }

    try:
        res = requests.post(url, json=payload, timeout=10)
        data = res.json()
        if data.get("ok"):
            print(f"[Notifier] Telegram message sent successfully to {chat_id}.")
            return True
        else:
            print(f"[Notifier] Telegram send failed: {data.get('description')}")
            return False
    except Exception as e:
        print(f"[Notifier] Telegram request error: {e}")
        return False

def send_promotion_alert(promo: Dict[str, Any]) -> bool:
    """Formats and sends a special flight deal alert to Telegram."""
    airline = promo.get("airline", "항공사")
    title = promo.get("title", "특가 프로모션")
    destinations = promo.get("destinations", "일본 노선")
    detail_url = promo.get("detail_url", "")
    
    start = promo.get("promo_start") or "진행중"
    end = promo.get("promo_end") or "소진 시 마감"
    period = f"{start} ~ {end}" if start != end else start
    travel_period = promo.get("travel_period") or "홈페이지 참조"

    msg_lines = [
        f"🚨 <b>[{airline}] 신규 공식 특가 오픈!</b>",
        "",
        f"📌 <b>이벤트:</b> {title}",
        f"📍 <b>노선/도시:</b> {destinations}",
        f"📅 <b>판매 기간:</b> {period}",
        f"✈️ <b>탑승 기간:</b> {travel_period}",
        "",
        f"🔗 <a href='{detail_url}'>공식 홈페이지 바로가기</a>"
    ]
    
    full_message = "\n".join(msg_lines)
    return send_telegram_message(full_message)

def test_telegram_connection() -> bool:
    """Sends a test message to verify the configuration."""
    test_message = (
        "✈️ <b>[항공 특가 알림 테스트]</b>\n\n"
        "텔레그램 봇 알림 연동이 성공적으로 완료되었습니다!\n"
        "이제 항공사 공식 특가가 감지되면 스마트폰으로 즉시 소리/진동 알림이 도착합니다. 🔔"
    )
    return send_telegram_message(test_message)

if __name__ == "__main__":
    print("Testing Telegram connection...")
    success = test_telegram_connection()
    if success:
        print("Success! Check your Telegram app.")
    else:
        print("Failed. Please check TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID in .env.")
