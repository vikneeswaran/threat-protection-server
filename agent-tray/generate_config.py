import json
import os
from pathlib import Path

DEFAULTS = {
    "api_base": "https://kuaminisystems.com/api/agent",
    "console_url": "https://kuaminisystems.com/securityAgent",
    "heartbeat_interval": 60,
}


def main():
    cfg = {
        "api_base": os.environ.get("API_BASE", DEFAULTS["api_base"]),
        "registration_token": os.environ.get("REGISTRATION_TOKEN", ""),
        "agent_id": os.environ.get("AGENT_ID", ""),
        "account_id": os.environ.get("ACCOUNT_ID", ""),
        "console_url": os.environ.get("CONSOLE_URL", DEFAULTS["console_url"]),
        "heartbeat_interval": int(os.environ.get("HEARTBEAT_INTERVAL", DEFAULTS["heartbeat_interval"])),
    }
    out_path = Path(__file__).parent / "config.json"
    out_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
