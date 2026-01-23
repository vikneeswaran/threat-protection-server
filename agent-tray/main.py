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

# --- SINGLETON ENFORCEMENT ---
def is_another_instance_running():
    import psutil
    this_pid = os.getpid()
    exe_name = "KuaminiSecurityClient.exe"
    count = 0
    for proc in psutil.process_iter(["pid", "name"]):
        try:
            if proc.info["name"] == exe_name and proc.info["pid"] != this_pid:
                count += 1
        except Exception:
            continue
    return count > 0

# Import PIL first and add Pillow 10+ compatibility patch for pystray
try:
    from PIL import Image, ImageDraw
except ImportError as e:
    print(f"[IMPORT ERROR] Failed to import PIL: {e}", file=sys.stderr)
    sys.exit(1)

# Compatibility fix for Pillow 10.0.0+ which removed Image.ANTIALIAS
# pystray 0.19.4 still uses this constant, so we need to patch it
if not hasattr(Image, 'ANTIALIAS'):
    if hasattr(Image, 'Resampling'):
        # Pillow 10.0.0+
        Image.ANTIALIAS = Image.Resampling.LANCZOS
    elif hasattr(Image, 'LANCZOS'):
        # Older Pillow versions
        Image.ANTIALIAS = Image.LANCZOS
    print("[COMPAT] Patched PIL.Image.ANTIALIAS for Pillow 10+ compatibility", file=sys.stderr)

# Try to import external dependencies with early error reporting
try:
    import psutil
except ImportError as e:
    print(f"[IMPORT ERROR] Failed to import psutil: {e}", file=sys.stderr)
    sys.exit(1)

try:
    import pystray
except ImportError as e:
    print(f"[IMPORT ERROR] Failed to import pystray: {e}", file=sys.stderr)
    sys.exit(1)

try:
    import requests
except ImportError as e:
    print(f"[IMPORT ERROR] Failed to import requests: {e}", file=sys.stderr)
    sys.exit(1)

DEFAULT_HEARTBEAT_INTERVAL = 60

def setup_ca_bundle():
    """Configure CA bundle path for requests library in PyInstaller bundled apps."""
    if getattr(sys, 'frozen', False):
        # Running as compiled PyInstaller executable
        exe_dir = Path(sys.executable).parent
        resources_dir = exe_dir.parent / "Resources"
        
        # Try common cert bundle paths in this order:
        possible_paths = [
            resources_dir / "certifi" / "cacert.pem",
            Path("/etc/ssl/certs/ca-certificates.crt"),
            Path("/etc/ssl/cert.pem"),
        ]
        
        for cert_path in possible_paths:
            if cert_path.exists():
                os.environ["REQUESTS_CA_BUNDLE"] = str(cert_path)
                print(f"[CA Bundle] Set to: {cert_path}", file=sys.stderr)
                return
        
        print("[CA Bundle] No cert bundle found, using requests defaults", file=sys.stderr)

def verify_installation():
    """Verify that the app bundle was installed correctly and fix common installation issues."""
    if not getattr(sys, 'frozen', False):
        # Not running as PyInstaller bundle, skip verification
        return
    
    issues = []
    
    # Check if running on macOS and app is in Applications
    if sys.platform == 'darwin':
        app_path = Path("/Applications/KuaminiSecurityClient.app")
        if not app_path.exists():
            issues.append("App bundle not found in /Applications")
    
    # Check config directory and create if missing
    config_dir = Path.home() / ".kuamini"
    if not config_dir.exists():
        try:
            config_dir.mkdir(parents=True, exist_ok=True)
            print(f"[Installation Fix] Created config directory: {config_dir}", file=sys.stderr)
        except Exception as e:
            issues.append(f"Could not create config directory: {e}")
    
    # Check config file and create default if missing
    config_file = config_dir / "config.json"
    if not config_file.exists():
        try:
            # Try to read registration token from install directory
            token_from_file = None
            if getattr(sys, 'frozen', False):
                install_dir = Path(sys.executable).parent
                token_file = install_dir / "registration_token.txt"
                if token_file.exists():
                    try:
                        token_from_file = token_file.read_text(encoding='utf-8').strip()
                        print(f"[Installation Fix] Found registration token in: {token_file}", file=sys.stderr)
                    except Exception as e:
                        print(f"[Installation Fix] Failed to read token file: {e}", file=sys.stderr)
            
            default_config = {
                "api_base": "https://kuaminisystems.com/api/agent",
                "console_url": "https://kuaminisystems.com/securityAgent",
                "auto_register": True,
                "heartbeat_interval": 60
            }
            
            # Include registration token if found
            if token_from_file:
                default_config["registration_token"] = token_from_file
                print(f"[Installation Fix] Added registration token to config", file=sys.stderr)
            
            config_file.write_text(json.dumps(default_config, indent=2))
            print(f"[Installation Fix] Created default config file: {config_file}", file=sys.stderr)
        except Exception as e:
            issues.append(f"Could not create config file: {e}")
    
    # Check LaunchAgent on macOS
    if sys.platform == 'darwin':
        plist_path = Path.home() / "Library/LaunchAgents/com.kuamini.securityclient.plist"
        if not plist_path.exists():
            print(f"[Installation Fix] LaunchAgent plist not found: {plist_path}", file=sys.stderr)
            print("[Installation Fix] Agent will need to be manually started or loaded via launchctl", file=sys.stderr)
    
    # Log any issues
    if issues:
        print(f"[Installation Issues] {', '.join(issues)}", file=sys.stderr)
    
    return len(issues) == 0

# Verify installation and setup CA bundle before any other operations
verify_installation()
# Setup CA bundle before any requests
setup_ca_bundle()

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
            base = Path.home() / "Library" / "Logs" / "KuaminiSecurityClient"
        elif os.name == "nt":
            base = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "KuaminiSecurityClient"
        else:
            base = Path.home() / ".local" / "share" / "KuaminiSecurityClient"
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
        # Read raw bytes and strip BOM if present
        try:
            raw_bytes = config_path.read_bytes()
            # Strip UTF-8 BOM if present (EF BB BF)
            if raw_bytes.startswith(b'\xef\xbb\xbf'):
                logging.info("Detected and stripping UTF-8 BOM from config")
                raw_bytes = raw_bytes[3:]
            # Strip UTF-16 LE BOM if present (FF FE)
            if raw_bytes.startswith(b'\xff\xfe'):
                logging.info("Detected UTF-16 LE BOM, decoding and re-encoding")
                text = raw_bytes.decode('utf-16-le')
                raw_bytes = text.encode('utf-8')
            text = raw_bytes.decode('utf-8')
            cfg = json.loads(text)
        except Exception as e:
            logging.error("Failed to load config with BOM handling: %s", e, exc_info=True)
            # Final fallback: try utf-8-sig
            try:
                with open(config_path, "r", encoding="utf-8-sig") as f:
                    cfg = json.load(f)
            except Exception as e2:
                logging.error("Final fallback failed: %s", e2, exc_info=True)
                raise
        
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
    # Fallback to env vars or token file
    logging.warning("Config file not found at %s, checking for token file or environment variables", config_path)
    
    # Check for registration_token.txt file in the installation directory
    token_from_file = None
    if getattr(sys, 'frozen', False):
        # Running as PyInstaller bundle
        install_dir = Path(sys.executable).parent
        token_file = install_dir / "registration_token.txt"
        if token_file.exists():
            try:
                token_from_file = token_file.read_text(encoding='utf-8').strip()
                logging.info("Found registration token in token file: %s", token_file)
            except Exception as e:
                logging.warning("Failed to read token file: %s", e)
    
    cfg = {
        "api_base": os.environ.get("API_BASE") or "https://kuaminisystems.com/api/agent",
        "registration_token": token_from_file or os.environ.get("REGISTRATION_TOKEN"),
        "agent_id": os.environ.get("AGENT_ID") or str(uuid.uuid4()),
        "account_id": os.environ.get("ACCOUNT_ID"),
        "console_url": os.environ.get("CONSOLE_URL", "https://kuaminisystems.com/securityAgent"),
        "heartbeat_interval": int(os.environ.get("HEARTBEAT_INTERVAL", DEFAULT_HEARTBEAT_INTERVAL)),
        "auto_register": True,
    }
    
    # Derive account_id from token if not already set
    if not cfg.get("account_id") and cfg.get("registration_token"):
        derived = _decode_account_id_from_token(cfg.get("registration_token"))
        if derived:
            cfg["account_id"] = derived
            logging.info("Derived account_id from token: %s", cfg["account_id"])
    
    return cfg


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


def make_icon(status_color=(46, 204, 113), status_text=""):
    """Generate a circular status icon with optional status indicator in the corner."""
    img = Image.new("RGB", (64, 64), (255, 255, 255))
    draw = ImageDraw.Draw(img)
    
    # Main circle (status indicator)
    draw.ellipse((8, 8, 56, 56), fill=status_color, outline=(40, 40, 40), width=2)
    
    # Status text or dot
    if status_text:
        try:
            # Try to draw a small indicator dot in corner if status text provided
            indicator_color = (46, 204, 113) if status_color == (46, 204, 113) else (231, 76, 60)
            draw.ellipse((48, 48, 62, 62), fill=indicator_color, outline=(40, 40, 40), width=1)
        except Exception as e:
            logging.debug("Could not draw status indicator: %s", e)
    
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
    # Ensure account_id is populated from token if present
    if not config.get("account_id"):
        decoded = _decode_account_id_from_token(config.get("registration_token"))
        if decoded:
            config["account_id"] = decoded
            try:
                save_config(config)
                logging.info("Persisted account_id from token before register: %s", decoded)
            except Exception as e:
                logging.warning("Failed to persist account_id before register: %s", e)

    # Validate configuration before attempting registration
    if not config.get("registration_token"):
        logging.error("Registration aborted: no registration_token in config")
        return False, "Missing registration_token"
    
    if not config.get("agent_id"):
        logging.error("Registration aborted: no agent_id in config")
        return False, "Missing agent_id"

    def _os_version():
        # mac/linux: prefer uname.release; windows: use platform helpers since sys.getwindowsversion may differ
        try:
            if hasattr(os, "uname"):
                return os.uname().release
            if os.name == "nt":
                import platform
                return platform.release() or platform.version() or "windows"
        except Exception as exc:
            logging.debug("Could not resolve os_version: %s", exc)
        return "unknown"

    payload = {
        "token": config.get("registration_token"),
        "hostname": os.uname().nodename if hasattr(os, "uname") else os.environ.get("COMPUTERNAME") or "unknown",
        "os": "macos" if sys.platform == "darwin" else ("windows" if os.name == "nt" else "linux"),
        "os_version": _os_version(),
        "agent_version": "tray-1.0.0",
        "agent_id": config.get("agent_id"),
    }
    try:
        api_url = config.get('api_base') or "https://kuaminisystems.com/api/agent"
        register_url = f"{api_url}/register"
        logging.info("Attempting registration to: %s", register_url)
        logging.debug("Registration payload: %s", {k: v if k != 'token' else '***' for k, v in payload.items()})
        
        resp = requests.post(register_url, json=payload, timeout=10)
        logging.info("Registration response status: %s", resp.status_code)
        
        if resp.status_code >= 400:
            try:
                error_detail = resp.json().get("error") or resp.text
            except:
                error_detail = resp.text
            logging.error("Registration HTTP %s: %s", resp.status_code, error_detail)
            return False, f"HTTP {resp.status_code}: {error_detail}"
        
        logging.info("Registration response: %s", resp.text[:200])
        resp.raise_for_status()

        # Persist endpoint_id and account_id from response if provided
        try:
            body = resp.json()
            endpoint_id = body.get("endpoint_id") or body.get("endpointId")
            if endpoint_id:
                config["endpoint_id"] = endpoint_id
                logging.info("Persisted endpoint_id: %s", endpoint_id)
            account_id = body.get("account_id") or body.get("accountId")
            if account_id:
                config["account_id"] = account_id
                logging.info("Persisted account_id from response: %s", account_id)
            save_config(config)
        except Exception as e:
            logging.warning("Could not persist registration response fields: %s", e)

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
        logging.error("Registration failed: %s", exc, exc_info=True)
        return False, str(exc)


def heartbeat(config):
    ip, mac = get_network_info()
    agent_id = config.get("agent_id") or None
    account_id = config.get("account_id") or None
    
    if not agent_id:
        logging.error("Heartbeat failed: missing agent_id")
        return False, "Missing agent_id"
    
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
        logging.debug("Sending heartbeat to %s", url)
        logging.debug("Heartbeat payload: agent_id=%s account_id=%s ip=%s", agent_id, account_id, ip)
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code >= 400:
            # Log response body for easier troubleshooting
            try:
                body = resp.json()
                error_msg = body.get("error", resp.text)
            except Exception:
                error_msg = resp.text
            logging.error("✗ Heartbeat HTTP %s: %s", resp.status_code, error_msg)
            resp.raise_for_status()
        logging.info("✓ Heartbeat successful (HTTP %s)", resp.status_code)
        return True, resp.json()
    except Exception as exc:
        logging.exception("✗ Heartbeat failed: %s", exc)

        # If endpoint not found, attempt re-registration once and retry heartbeat
        try:
            status = exc.response.status_code if hasattr(exc, "response") and exc.response is not None else None
        except Exception:
            status = None

        if status == 404:
            logging.warning("Heartbeat 404: attempting re-registration")
            ok_reg, res_reg = register(config)
            logging.info("Re-register result after 404: ok=%s res=%s", ok_reg, res_reg)
            if ok_reg:
                try:
                    logging.info("Retrying heartbeat after re-registration...")
                    resp_retry = requests.post(url, json=payload, timeout=15)
                    if resp_retry.status_code < 400:
                        return True, resp_retry.json()
                    else:
                        logging.error("Retry heartbeat HTTP %s: %s", resp_retry.status_code, resp_retry.text)
                except Exception as exc_retry:
                    logging.exception("Retry heartbeat failed: %s", exc_retry)

        return False, str(exc)


def tray_main():
    """Run as full tray application with icon and menu."""
    setup_logging()
    logging.info("Starting Kuamini Agent Tray")
    config = load_config()

    status = {"text": "Idle", "color": (46, 204, 113)}
    
    # Create icon with error handling
    try:
        icon = pystray.Icon("KuaminiThreatProtectAgent")
        logging.info("✓ Tray icon object created successfully")
    except Exception as e:
        logging.error("✗ Failed to create pystray icon: %s", e, exc_info=True)
        logging.warning("Falling back to background-only mode (no systray)")
        # Fallback to background-only mode
        background_agent_mode(config)
        return

    stop_event = threading.Event()

    def set_status(text, color=(46, 204, 113)):
        status["text"] = text
        status["color"] = color
        try:
            icon.icon = make_icon(color, text)
            icon.title = f"Kuamini: {text}"
        except Exception as e:
            logging.debug("Could not update icon: %s", e)
        logging.info("Status changed: %s (color: %s)", text, color)

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

    def build_menu():
        """Build menu dynamically so status updates in real time."""
        return pystray.Menu(
            pystray.MenuItem(lambda item: f"● Agent: {config.get('agent_id', 'unknown')[:8]}...", None, enabled=False),
            pystray.MenuItem(lambda item: f"◉ Status: {status.get('text', 'Unknown')}", None, enabled=False),
            pystray.MenuItem(lambda item: f"  Account: {config.get('account_id', 'Not set')[:8]}..." if config.get('account_id') else "  Account: Not configured", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Register now", do_register),
            pystray.MenuItem("Send heartbeat", do_heartbeat),
            pystray.MenuItem("Open console", open_console),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", quit_app),
        )
    
    icon.menu = build_menu()

    set_status("Starting")
    
    # Auto-register on startup (works with or without registration_token)
    if config.get("auto_register"):
        set_status("Registering...")
        logging.info("Auto-registration enabled, attempting registration")
        ok, res = register(config)
        if ok:
            logging.info("✓ Auto-registration successful: %s", res)
            set_status("Registered, preparing heartbeat")
        else:
            logging.warning("✗ Auto-registration failed: %s", res)
            set_status("Registration failed, retrying on heartbeat")
    
    threading.Thread(target=heartbeat_loop, daemon=True).start()
    icon.icon = make_icon(status["color"])
    
    # Run the tray icon with error recovery
    try:
        logging.info("Starting tray icon message loop...")
        icon.run()
    except Exception as e:
        logging.warning("✗ Tray icon failed: %s. Continuing in background mode...", e, exc_info=True)
        # Continue running background operations even if icon fails
        try:
            while not stop_event.is_set():
                stop_event.wait(1)
        except KeyboardInterrupt:
            logging.info("Shutting down...")
            stop_event.set()


def background_agent_mode(config):
    """Run as background agent without tray UI (fallback mode)."""
    logging.info("Running in background-only mode")
    
    stop_event = threading.Event()
    
    def heartbeat_loop():
        interval = int(config.get("heartbeat_interval") or DEFAULT_HEARTBEAT_INTERVAL)
        
        # Initial registration
        logging.info("Attempting initial registration...")
        ok, res = register(config)
        if ok:
            logging.info("✓ Initial registration successful: %s", res)
        else:
            logging.warning("⚠ Initial registration failed: %s", res)
        
        # Heartbeat loop
        while not stop_event.is_set():
            try:
                ok, _ = heartbeat(config)
                if not ok:
                    logging.warning("Heartbeat failed, will retry")
            except Exception as e:
                logging.error("Heartbeat error: %s", e)
            
            # Wait for next interval
            stop_event.wait(interval)
    
    # Start heartbeat thread
    hb_thread = threading.Thread(target=heartbeat_loop, daemon=False)
    hb_thread.start()
    
    logging.info("✓ Agent started successfully (background mode)")
    logging.info("✓ Agent ID: %s", config.get('agent_id', 'unknown'))
    logging.info("✓ API Base: %s", config.get('api_base'))
    
    # Keep the main thread alive
    try:
        while not stop_event.is_set():
            stop_event.wait(1)
    except KeyboardInterrupt:
        logging.info("Received shutdown signal")
        stop_event.set()
        hb_thread.join(timeout=5)


if __name__ == "__main__":
    def safe_print(msg: str):
        stream = sys.stderr or sys.stdout
        if stream is None:
            return
        print(msg, file=stream)
        try:
            stream.flush()
        except Exception:
            pass

    # Ensure all output is captured, even on early crashes
    safe_print("[STARTUP] Agent starting...")
    
    try:
        safe_print("[STARTUP] About to call tray_main()")
        tray_main()
    except KeyboardInterrupt:
        safe_print("[SHUTDOWN] Received keyboard interrupt")
    except Exception as e:
        # Ensure unexpected exceptions are logged, even before setup_logging
        safe_print(f"[ERROR] Exception before setup_logging: {type(e).__name__}: {e}")
        import traceback
        stream = sys.stderr or sys.stdout
        if stream:
            try:
                traceback.print_exc(file=stream)
                stream.flush()
            except Exception:
                pass
        
        # Try to also setup logging and log the error
        try:
            setup_logging()
            logging.exception("Fatal error: %s", e)
        except Exception as log_error:
            print(f"[ERROR] Failed to setup logging: {log_error}", file=sys.stderr)
            sys.stderr.flush()
