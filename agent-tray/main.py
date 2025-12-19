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
import uuid

import psutil
import pystray
import requests
from PIL import Image, ImageDraw

DEFAULT_HEARTBEAT_INTERVAL = 60


def get_config_path() -> Path:
    """Find config.json in multiple locations for PyInstaller compatibility and pre-configured installers."""
    # 1. Bundled config in app Resources folder (for pre-configured installers)
    if getattr(sys, 'frozen', False):
        # Running as compiled executable
        exe_dir = Path(sys.executable).parent
        
        # Check for bundled config in Resources folder (macOS .app structure)
        resources_dir = exe_dir.parent / "Resources"
        bundled_config = resources_dir / "config.json"
        if bundled_config.exists():
            logging.info("Found bundled config at: %s", bundled_config)
            # Copy to user directory if not exists
            user_config = Path.home() / ".kuamini" / "config.json"
            if not user_config.exists():
                user_config.parent.mkdir(parents=True, exist_ok=True)
                import shutil
                shutil.copy2(bundled_config, user_config)
                logging.info("Copied bundled config to user directory: %s", user_config)
            return user_config
        
        # Check next to executable
        candidate = exe_dir / "config.json"
        if candidate.exists():
            return candidate
    
    # 2. User data directory (~/.kuamini/config.json)
    user_config = Path.home() / ".kuamini" / "config.json"
    if user_config.exists():
        return user_config
    
    # 3. Next to the script (for development)
    script_dir = Path(__file__).parent
    candidate = script_dir / "config.json"
    if candidate.exists():
        return candidate
    
    # 4. Fallback: use user dir for new config
    user_config.parent.mkdir(parents=True, exist_ok=True)
    return user_config


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


def _decode_account_id_from_token(token: str | None) -> str | None:
    if not token:
        return None
    try:
        import base64
        cleaned = str(token).replace("\n", "").replace(" ", "")
        decoded = base64.b64decode(cleaned).decode("utf-8")
        obj = json.loads(decoded)
        account_id = obj.get("accountId") or obj.get("account_id")
        if isinstance(account_id, str) and account_id.strip():
            return account_id
    except Exception as e:
        logging.warning("Failed to decode account_id from token: %s", e)
    return None


def load_config():
    config_path = get_config_path()
    logging.info("Looking for config at: %s", config_path)
    if config_path.exists():
        logging.info("Loading config from: %s", config_path)
        with open(config_path, "r", encoding="utf-8") as f:
            cfg = json.load(f)
        
        # Ensure agent_id exists; generate a persistent one if missing/empty
        agent_id = cfg.get("agent_id")
        if not agent_id or (isinstance(agent_id, str) and not agent_id.strip()):
            logging.warning("Config has no valid agent_id (was: %s), generating new one", repr(agent_id))
            cfg["agent_id"] = str(uuid.uuid4())
            logging.info("Generated agent_id: %s", cfg["agent_id"])
            try:
                save_config(cfg)
                logging.info("Successfully saved new agent_id to config")
            except Exception as e:
                logging.error("CRITICAL: Failed to save agent_id to config: %s", e, exc_info=True)
        else:
            logging.info("Using existing agent_id from config: %s", agent_id)
        
        # Ensure account_id exists; derive from registration_token if available
        if not cfg.get("account_id") and cfg.get("registration_token"):
            derived = _decode_account_id_from_token(cfg.get("registration_token"))
            if derived:
                cfg["account_id"] = derived
                try:
                    save_config(cfg)
                    logging.info("Derived account_id from token and saved to config: %s", cfg["account_id"])
                except Exception as e:
                    logging.warning("Failed to persist derived account_id: %s", e)
        return cfg
    # Fallback to env vars
    logging.warning("Config file not found at %s, using environment variables", config_path)
    return {
        "api_base": os.environ.get("API_BASE"),
        "registration_token": os.environ.get("REGISTRATION_TOKEN"),
        "agent_id": os.environ.get("AGENT_ID") or str(uuid.uuid4()),
        "account_id": os.environ.get("ACCOUNT_ID"),
        "console_url": os.environ.get("CONSOLE_URL", "https://kuaminisystems.com/securityAgent"),
        "heartbeat_interval": int(os.environ.get("HEARTBEAT_INTERVAL", DEFAULT_HEARTBEAT_INTERVAL)),
    }


def save_config(cfg: dict):
    """Persist config back to config.json in the resolved location."""
    config_path = get_config_path()
    try:
        with open(config_path, "w", encoding="utf-8") as f:
            json.dump(cfg, f, indent=2)
        logging.info("Saved config to: %s", config_path)
    except Exception as e:
        logging.warning("Failed to save config to %s: %s", config_path, e)


def _antialias_filter():
    # Pillow 10 removed Image.ANTIALIAS; use Resampling.LANCZOS when available
    if hasattr(Image, "Resampling"):
        return Image.Resampling.LANCZOS
    if hasattr(Image, "LANCZOS"):
        return Image.LANCZOS
    return Image.NEAREST


def make_icon(status_color=(46, 204, 113)):
    # Generate a simple circular icon in memory (green by default)
    img = Image.new("RGB", (64, 64), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    draw.ellipse((8, 8, 56, 56), fill=status_color, outline=(40, 40, 40))
    return img.resize((64, 64), _antialias_filter())


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
        # Persist account_id if missing, derived from token
        if not config.get("account_id") and config.get("registration_token"):
            derived = _decode_account_id_from_token(config.get("registration_token"))
            if derived:
                config["account_id"] = derived
                try:
                    save_config(config)
                    logging.info("Persisted account_id from token after register: %s", derived)
                except Exception as e:
                    logging.warning("Failed to save derived account_id after register: %s", e)
        return True, resp.json()
    except Exception as exc:
        return False, str(exc)


def heartbeat(config):
    ip, mac = get_network_info()
    agent_id = config.get("agent_id") or None
    account_id = config.get("account_id") or None
    payload = {
        "agent_id": agent_id,
        "account_id": account_id,
        "status": "online",
        "system_info": {
            "os": "macos" if sys.platform == "darwin" else ("windows" if os.name == "nt" else "linux"),
            "hostname": os.uname().nodename if hasattr(os, "uname") else os.environ.get("COMPUTERNAME") or "unknown",
            "ip": ip,
            "mac": mac,
        },
    }
    try:
        url = f"{config['api_base']}/heartbeat"
        logging.info("Sending heartbeat to %s with payload: %s", url, payload)
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code >= 400:
            # Log response body for easier troubleshooting
            try:
                body = resp.text
            except Exception:
                body = "<no body>"
            logging.error("Heartbeat HTTP %s: %s", resp.status_code, body)
            resp.raise_for_status()
        return True, resp.json()
    except Exception as exc:
        logging.exception("Heartbeat failed: %s", exc)
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
        pystray.MenuItem(lambda item: f"Agent: {config.get('agent_id') or 'unknown'}", None, enabled=False),
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
