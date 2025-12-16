import json
import os
import sys
import threading
import time
import webbrowser
import logging
import subprocess
from pathlib import Path
from typing import Tuple

import psutil
import pystray
import requests
from PIL import Image, ImageDraw

CONFIG_PATH = Path(__file__).parent / "config.json"
DEFAULT_HEARTBEAT_INTERVAL = 60


def get_log_path() -> Path:
    try:
        if sys.platform == "darwin":
            base = Path.home() / "Library" / "Logs" / "KuaminiAgentTray"
        elif os.name == "nt":
            base = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "KuaminiAgentTray"
        else:
            base = Path.home() / ".local" / "share" / "KuaminiAgentTray"
        base.mkdir(parents=True, exist_ok=True)
        return base / "agent.log"
    except Exception:
        # fallback to current directory
        return Path("agent.log")


def setup_logging():
    log_path = get_log_path()
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(message)s",
        handlers=[
            logging.FileHandler(log_path, encoding="utf-8"),
            logging.StreamHandler(),
        ],
    )
    logging.info("Logging initialized at %s", log_path)


def load_config():
    if CONFIG_PATH.exists():
        with open(CONFIG_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    # Fallback to env vars
    return {
        "api_base": os.environ.get("API_BASE"),
        "registration_token": os.environ.get("REGISTRATION_TOKEN"),
        "agent_id": os.environ.get("AGENT_ID"),
        "account_id": os.environ.get("ACCOUNT_ID"),
        "console_url": os.environ.get("CONSOLE_URL", "https://kuaminisystems.com/securityAgent"),
        "heartbeat_interval": int(os.environ.get("HEARTBEAT_INTERVAL", DEFAULT_HEARTBEAT_INTERVAL)),
    }


def make_icon(status_color=(46, 204, 113)):
    # Generate a simple circular icon in memory (green by default)
    img = Image.new("RGB", (64, 64), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse((8, 8, 56, 56), fill=status_color, outline=(40, 40, 40))
    return img


def get_network_info() -> Tuple[str | None, str | None]:
    ip = None
    mac = None
    for iface, addrs in psutil.net_if_addrs().items():
        for addr in addrs:
            if addr.family.name == "AF_INET" and not ip:
                ip = addr.address
            if addr.family.name == "AF_PACKET" and not mac:
                mac = addr.address
    return ip, mac


def register(config):
    payload = {
        "token": config.get("registration_token"),
        "hostname": os.uname().nodename,
        "os": "macos" if sys.platform == "darwin" else ("windows" if os.name == "nt" else "linux"),
        "os_version": os.uname().release,
        "agent_version": "tray-1.0.0",
        "agent_id": config.get("agent_id"),
    }
    try:
        resp = requests.post(f"{config['api_base']}/register", json=payload, timeout=10)
        resp.raise_for_status()
        return True, resp.json()
    except Exception as exc:
        return False, str(exc)


def heartbeat(config):
    ip, mac = get_network_info()
    payload = {
        "agent_id": config.get("agent_id"),
        "account_id": config.get("account_id"),
        "status": "online",
        "system_info": {
            "os": "macos" if sys.platform == "darwin" else ("windows" if os.name == "nt" else "linux"),
            "hostname": os.uname().nodename if hasattr(os, "uname") else os.environ.get("COMPUTERNAME") or "unknown",
            "ip": ip,
            "mac": mac,
        },
    }
    try:
        resp = requests.post(f"{config['api_base']}/heartbeat", json=payload, timeout=10)
        resp.raise_for_status()
        return True, resp.json()
    except Exception as exc:
        return False, str(exc)


def tray_main():
    setup_logging()
    logging.info("Starting Kuamini Agent Tray")
    config = load_config()
    status = {"text": "Idle", "color": (46, 204, 113)}
    icon = pystray.Icon("KuaminiThreatProtectAgent")

    stop_event = threading.Event()

    def set_status(text, color=(46, 204, 113)):
        status["text"] = text
        status["color"] = color
        icon.icon = make_icon(color)
        icon.title = f"Kuamini Agent — {text}"
        logging.info("Status changed: %s", text)

    def do_register(icon_, item):
        ok, res = register(config)
        logging.info("Register result: ok=%s, res=%s", ok, res)
        set_status("Registered" if ok else "Register failed", (46, 204, 113) if ok else (231, 76, 60))

    def do_heartbeat(icon_, item):
        ok, res = heartbeat(config)
        logging.info("Heartbeat result: ok=%s, res=%s", ok, res)
        set_status("Online" if ok else "Heartbeat failed", (46, 204, 113) if ok else (231, 76, 60))

    def open_console(icon_, item):
        url = config.get("console_url", "https://kuaminisystems.com/securityAgent")
        logging.info("Opening console: %s", url)
        webbrowser.open(url)

    def quit_app(icon_, item):
        stop_event.set()
        icon.stop()

    def heartbeat_loop():
        interval = int(config.get("heartbeat_interval") or DEFAULT_HEARTBEAT_INTERVAL)
        while not stop_event.is_set():
            ok, _ = heartbeat(config)
            set_status("Online" if ok else "Heartbeat failed", (46, 204, 113) if ok else (231, 76, 60))
            stop_event.wait(interval)

    icon.menu = pystray.Menu(
        pystray.MenuItem(lambda item: f"Agent: {config.get('agent_id', 'unknown')}", None, enabled=False),
        pystray.MenuItem(lambda item: f"Status: {status['text']}", None, enabled=False),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Register now", do_register),
        pystray.MenuItem("Send heartbeat", do_heartbeat),
        pystray.MenuItem("Open console", open_console),
        pystray.Menu.SEPARATOR,
        pystray.MenuItem("Quit", quit_app),
    )

    set_status("Starting")
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    icon.icon = make_icon(status["color"])
    try:
        icon.run()
    except Exception as e:
        logging.exception("Tray icon run failed: %s", e)
        if sys.platform == "darwin":
            try:
                subprocess.run([
                    "osascript",
                    "-e",
                    'display alert "Kuamini Agent" message "The tray failed to start. See log file for details."',
                ], check=False)
            except Exception:
                pass


if __name__ == "__main__":
    try:
        tray_main()
    except KeyboardInterrupt:
        pass
    except Exception as e:
        # Ensure unexpected exceptions are logged
        try:
            setup_logging()
            logging.exception("Fatal error: %s", e)
        except Exception:
            pass
