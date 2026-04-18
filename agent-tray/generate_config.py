import json
import os
from pathlib import Path

DEFAULTS = {
    "api_base": "https://kuaminisystems.com/api/agent",
    "console_url": "https://kuaminisystems.com/securityAgent",
    "heartbeat_interval": 60,
}


def main():
    token = os.environ.get("REGISTRATION_TOKEN", "")
    if not token or token.strip() == "":
        print("ERROR: REGISTRATION_TOKEN environment variable is required to generate config.json.")
        print("Obtain your registration token from the Kuamini Security Console and set it as REGISTRATION_TOKEN.")
        exit(1)

    agent_id = os.environ.get("AGENT_ID", "")
    if not agent_id or agent_id.strip() == "":
        import uuid
        agent_id = str(uuid.uuid4())

    cfg = {
        "api_base": os.environ.get("API_BASE", DEFAULTS["api_base"]),
        "registration_token": token,
        "agent_id": agent_id,
        "account_id": os.environ.get("ACCOUNT_ID", ""),
        "console_url": os.environ.get("CONSOLE_URL", DEFAULTS["console_url"]),
        "heartbeat_interval": int(os.environ.get("HEARTBEAT_INTERVAL", DEFAULTS["heartbeat_interval"])),
    }
    out_path = Path(__file__).parent / "config.json"
    out_path.write_text(json.dumps(cfg, indent=2), encoding="utf-8")
    print(f"Wrote {out_path}")


if __name__ == "__main__":
    main()
