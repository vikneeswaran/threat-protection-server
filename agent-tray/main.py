import json
import os
import sys
import threading
import time
import webbrowser
import logging
import subprocess
import tempfile
import socket
import ipaddress
from pathlib import Path
from typing import Tuple
from urllib.parse import urlparse
import uuid

# --- SINGLETON ENFORCEMENT ---
def is_another_instance_running():
    import psutil
    this_pid = os.getpid()

    def _looks_like_agent_process(proc_info: dict) -> bool:
        name = str(proc_info.get("name") or "")
        exe = str(proc_info.get("exe") or "")
        cmdline_parts = proc_info.get("cmdline") or []
        cmdline = " ".join(str(p) for p in cmdline_parts)

        # Compiled app / executable names
        if "KuaminiSecurityClient" in name or "KuaminiSecurityClient" in exe:
            return True

        # Dev run: python .../agent-tray/main.py
        lower_cmd = cmdline.lower()
        if "main.py" in lower_cmd and "agent-tray" in lower_cmd:
            return True

        return False

    for proc in psutil.process_iter(["pid", "name", "exe", "cmdline"]):
        try:
            if proc.info.get("pid") == this_pid:
                continue
            if _looks_like_agent_process(proc.info):
                return True
        except Exception:
            continue
    return False

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
AGENT_VERSION = os.environ.get("AGENT_VERSION", "1.0.6")
PUBLIC_IP_CACHE_TTL_SECONDS = 600
_public_ip_cache_value: str | None = None
_public_ip_cache_ts: float = 0.0

def get_log_path() -> Path:
    """Get the path for the agent log file - define early so setup_logging can use it."""
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


def setup_ca_bundle():
    """Configure CA bundle path for requests library in PyInstaller bundled apps."""
    if getattr(sys, 'frozen', False):
        # Running as compiled PyInstaller executable
        exe_dir = Path(sys.executable).parent
        resources_dir = exe_dir.parent / "Resources"
        
        # Try common cert bundle paths in this order:
        possible_paths = [
            resources_dir / "certifi" / "cacert.pem",
            exe_dir / "certifi" / "cacert.pem",  # PyInstaller may place it here
            Path("/etc/ssl/certs/ca-certificates.crt"),
            Path("/etc/ssl/cert.pem"),
        ]
        
        for cert_path in possible_paths:
            if cert_path.exists():
                os.environ["REQUESTS_CA_BUNDLE"] = str(cert_path)
                print(f"[CA Bundle] Set to: {cert_path}", file=sys.stderr)
                return
        
        # If no bundle found, let requests use system defaults (Windows handles this well)
        print("[CA Bundle] No custom cert bundle found, requests will use system defaults", file=sys.stderr)

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
    
    # Determine config directory based on OS
    if os.name == "nt":
        # Windows: use LOCALAPPDATA
        localappdata = Path(os.environ.get("LOCALAPPDATA", Path.home()))
        config_dir = localappdata / "KuaminiSecurityClient"
    else:
        # macOS/Linux: use ~/.kuamini
        config_dir = Path.home() / ".kuamini"
    
    # Check config directory and create if missing
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
            token_file_path = None
            if getattr(sys, 'frozen', False):
                install_dir = Path(sys.executable).parent
                # Check for registration.token (created by MSI build) - try both names
                for token_filename in ["registration.token", "registration_token.txt"]:
                    token_file = install_dir / token_filename
                    if token_file.exists():
                        try:
                            token_from_file = token_file.read_text(encoding='utf-8').strip()
                            token_file_path = token_file
                            print(f"[Installation Fix] Found registration token in: {token_file}", file=sys.stderr)
                            break
                        except Exception as e:
                            print(f"[Installation Fix] Failed to read token file {token_filename}: {e}", file=sys.stderr)
                
                # If not found in install dir, check Downloads and Desktop
                if not token_from_file:
                    search_dirs = [
                        Path.home() / "Downloads",
                        Path.home() / "Desktop",
                        Path.cwd(),  # current working directory
                    ]
                    for search_dir in search_dirs:
                        # First check directly in the folder
                        for token_filename in ["registration.token", "registration_token.txt"]:
                            token_file = search_dir / token_filename
                            if token_file.exists():
                                try:
                                    content = token_file.read_text(encoding='utf-8').strip()
                                    # Verify it's not the placeholder
                                    if content != "placeholder-token" and len(content) > 50:
                                        token_from_file = content
                                        token_file_path = token_file
                                        print(f"[Installation Fix] Found registration token in search dir: {token_file}", file=sys.stderr)
                                        # Copy it to install dir for next time
                                        try:
                                            (install_dir / token_filename).write_text(content)
                                            print(f"[Installation Fix] Copied token to install dir", file=sys.stderr)
                                        except Exception as e:
                                            print(f"[Installation Fix] Could not copy token to install dir: {e}", file=sys.stderr)
                                        break
                                except Exception as e:
                                    print(f"[Installation Fix] Failed to read token from {token_file}: {e}", file=sys.stderr)
                        
                        # Also check in KuaminiSecurityClient-* subdirectories
                        if not token_from_file and search_dir.exists():
                            try:
                                for subdir in search_dir.glob("KuaminiSecurityClient-*"):
                                    if subdir.is_dir():
                                        for token_filename in ["registration.token", "registration_token.txt"]:
                                            token_file = subdir / token_filename
                                            if token_file.exists():
                                                try:
                                                    content = token_file.read_text(encoding='utf-8').strip()
                                                    # Verify it's not the placeholder
                                                    if content != "placeholder-token" and len(content) > 50:
                                                        token_from_file = content
                                                        token_file_path = token_file
                                                        print(f"[Installation Fix] Found registration token in subdirectory: {token_file}", file=sys.stderr)
                                                        # Copy it to install dir for next time
                                                        try:
                                                            (install_dir / token_filename).write_text(content)
                                                            print(f"[Installation Fix] Copied token to install dir", file=sys.stderr)
                                                        except Exception as e:
                                                            print(f"[Installation Fix] Could not copy token to install dir: {e}", file=sys.stderr)
                                                        break
                                                except Exception as e:
                                                    print(f"[Installation Fix] Failed to read token from {token_file}: {e}", file=sys.stderr)
                                        if token_from_file:
                                            break
                            except Exception as e:
                                print(f"[Installation Fix] Error searching subdirectories in {search_dir}: {e}", file=sys.stderr)
                        
                        if token_from_file:
                            break
            
            default_config = {
                "api_base": "https://kuaminisystems.com/api/agent",
                "console_url": "https://kuaminisystems.com/securityAgent",
                "auto_register": True,
                "heartbeat_interval": 60
            }
            
            # Generate fresh agent_id for this installation
            import uuid
            default_config["agent_id"] = str(uuid.uuid4())
            
            # Include registration token if found
            if token_from_file:
                default_config["registration_token"] = token_from_file
                print(f"[Installation Fix] Added registration token to config", file=sys.stderr)
            
            config_file.write_text(json.dumps(default_config, indent=2))
            print(f"[Installation Fix] Created default config file: {config_file}", file=sys.stderr)
            
            # Delete registration.token after consuming it (only if we found and read it)
            if token_file_path and token_file_path.exists() and token_from_file:
                try:
                    token_file_path.unlink()
                    print(f"[Installation Fix] Deleted consumed registration token file", file=sys.stderr)
                except Exception as e:
                    print(f"[Installation Fix] Could not delete token file: {e}", file=sys.stderr)
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
    # Windows-specific paths first (LOCALAPPDATA is more reliable for APP data)
    if os.name == "nt":
        localappdata = Path(os.environ.get("LOCALAPPDATA", Path.home()))
        win_config = localappdata / "KuaminiSecurityClient" / "config.json"
        if win_config.exists():
            return win_config
        # Also check user home .kuamini as fallback
        user_config_alt = Path.home() / ".kuamini" / "config.json"
        if user_config_alt.exists():
            return user_config_alt
    
    # 1. User data directory (~/.kuamini/config.json) - prioritize user config which was created on first run
    user_config = Path.home() / ".kuamini" / "config.json"
    if user_config.exists():
        return user_config
    
    # 2. Check next to executable (Windows installer uses this)
    if getattr(sys, 'frozen', False):
        exe_dir = Path(sys.executable).parent
        candidate = exe_dir / "config.json"
        if candidate.exists():
            logging.info("Found config next to executable: %s", candidate)
            return candidate
        
        # Check for bundled config in Resources folder (macOS .app structure)
        resources_dir = exe_dir.parent / "Resources"
        bundled_config = resources_dir / "config.json"
        if bundled_config.exists():
            logging.info("Found bundled config at: %s", bundled_config)
            # Copy to user directory if not exists
            user_config.parent.mkdir(parents=True, exist_ok=True)
            import shutil
            shutil.copy2(bundled_config, user_config)
            logging.info("Copied bundled config to user directory: %s", user_config)
            return user_config
    
    # 3. Next to the script (for development)
    script_dir = Path(__file__).parent
    candidate = script_dir / "config.json"
    if candidate.exists():
        return candidate
    
    # 4. Fallback: use Windows-specific path if on Windows, otherwise user home
    if os.name == "nt":
        localappdata = Path(os.environ.get("LOCALAPPDATA", Path.home()))
        config_dir = localappdata / "KuaminiSecurityClient"
        config_dir.mkdir(parents=True, exist_ok=True)
        return config_dir / "config.json"
    else:
        user_config.parent.mkdir(parents=True, exist_ok=True)
        return user_config


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
        # Token might be in JWT format with newlines: header.payload.signature
        # Clean whitespace completely - JSON might have formatted it across multiple lines
        cleaned = ''.join(str(token).split())  # Remove all whitespace
        
        # Split by dot to get parts
        parts = cleaned.split(".")
        if len(parts) < 1:
            logging.warning("Token does not appear valid (empty)")
            return None
        
        # Try different parts as payload (account info can be in different positions)
        # Usually position 0 or 1, depending on JWT format
        for part_index in [0, 1]:
            if part_index >= len(parts):
                continue
                
            try:
                payload = parts[part_index]
                # Add padding if necessary (base64 requires length to be multiple of 4)
                padding_needed = len(payload) % 4
                if padding_needed:
                    payload += "=" * (4 - padding_needed)
                
                # Try to decode
                decoded = base64.b64decode(payload).decode("utf-8")
                obj = json.loads(decoded)
                account_id = obj.get("accountId") or obj.get("account_id")
                if isinstance(account_id, str) and account_id.strip():
                    logging.debug("Successfully decoded account_id from token part [%d]", part_index)
                    return account_id
            except Exception:
                # This part didn't have the account_id, try next
                continue
                
        # If we get here, couldn't decode account_id from any part
        logging.debug("Could not find account_id in any token part")
        return None
    except Exception as e:
        logging.debug("Failed to decode account_id from token: %s", e)
    return None


def load_config():
    def _discover_token_from_install_paths() -> str | None:
        """Best-effort token discovery from installer/runtime locations."""
        candidate_dirs = []
        try:
            if getattr(sys, 'frozen', False):
                exe_dir = Path(sys.executable).parent
                candidate_dirs.extend([exe_dir, exe_dir.parent / "Resources"])
        except Exception:
            pass

        # Dev/runtime fallbacks
        try:
            candidate_dirs.append(Path(__file__).parent)
        except Exception:
            pass
        try:
            candidate_dirs.append(Path.cwd())
        except Exception:
            pass

        for base in candidate_dirs:
            for token_name in ["registration.token", "registration_token.txt"]:
                token_file = base / token_name
                if token_file.exists():
                    try:
                        token = token_file.read_text(encoding="utf-8").strip()
                        if token:
                            logging.info("Recovered registration token from: %s", token_file)
                            return token
                    except Exception as e:
                        logging.warning("Failed reading token file %s: %s", token_file, e)
        return None

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

        # Recover token if existing config was created without one
        if not cfg.get("registration_token"):
            recovered_token = _discover_token_from_install_paths() or os.environ.get("REGISTRATION_TOKEN")
            if recovered_token:
                cfg["registration_token"] = recovered_token
                logging.info("Recovered missing registration_token and updating config")
                if not cfg.get("account_id"):
                    derived = _decode_account_id_from_token(recovered_token)
                    if derived:
                        cfg["account_id"] = derived
                try:
                    save_config(cfg)
                except Exception as e:
                    logging.warning("Failed to persist recovered registration token: %s", e)
        return cfg
    # Fallback to env vars or token file
    logging.warning("Config file not found at %s, checking for token file or environment variables", config_path)
    
    # Check for token files in known installation/runtime paths
    token_from_file = _discover_token_from_install_paths()
    
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
    def _score_ipv4(address: str) -> int:
        """Higher score means better candidate for endpoint local IP."""
        try:
            ip_obj = ipaddress.ip_address(address)
            if ip_obj.version != 4:
                return -1
            if ip_obj.is_loopback:
                return -10
            if ip_obj.is_link_local:  # 169.254.x.x
                return -5
            if ip_obj.is_private:  # RFC1918 - usually what we want in console
                return 30
            if ip_obj.is_global:
                return 20
            return 0
        except Exception:
            return -1

    def _is_virtual_iface(name: str) -> bool:
        lowered = name.lower()
        virtual_markers = [
            "loopback",
            "docker",
            "veth",
            "vmnet",
            "utun",
            "zerotier",
            "tailscale",
            "bridge",
            "br-",
            "virtual",
            "npcap",
        ]
        return lowered.startswith("lo") or any(marker in lowered for marker in virtual_markers)

    # 1) Best-effort primary outbound IPv4 using routing table decision.
    primary_ip = None
    try:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.connect(("8.8.8.8", 80))
        candidate = sock.getsockname()[0]
        sock.close()
        # Discard if loopback or link-local — the routing trick gave a bad result
        if candidate and not candidate.startswith("127.") and not candidate.startswith("169.254."):
            primary_ip = candidate
    except Exception:
        primary_ip = None

    addrs_by_iface = psutil.net_if_addrs()
    stats_by_iface = psutil.net_if_stats()

    candidates: list[tuple[int, str, str]] = []  # (score, ip, iface)
    for iface, addrs in addrs_by_iface.items():
        iface_name = str(iface)
        iface_virtual = _is_virtual_iface(iface_name)
        iface_is_up = bool(stats_by_iface.get(iface_name).isup) if stats_by_iface.get(iface_name) else True

        for addr in addrs:
            family_name = getattr(addr.family, "name", str(addr.family))
            if family_name != "AF_INET":
                continue

            ipv4 = (addr.address or "").strip()
            if not ipv4:
                continue

            score = _score_ipv4(ipv4)
            if iface_is_up:
                score += 3
            if iface_virtual:
                score -= 8
            if primary_ip and ipv4 == primary_ip:
                score += 20

            candidates.append((score, ipv4, iface_name))

    candidates.sort(key=lambda item: item[0], reverse=True)
    best_ip = candidates[0][1] if candidates else primary_ip
    best_iface = candidates[0][2] if candidates else None

    # Extra fallback for environments where routing trick + psutil enumeration
    # do not produce an IPv4 candidate (some restricted Windows setups).
    if not best_ip:
        try:
            host = socket.gethostname()
            for candidate in socket.gethostbyname_ex(host)[2]:
                if candidate and not candidate.startswith("127.") and not candidate.startswith("169.254."):
                    best_ip = candidate
                    break
        except Exception:
            pass

    def _valid_mac(value: str | None) -> bool:
        if not value:
            return False
        candidate = value.strip().lower().replace("-", ":")
        return candidate not in ("", "00:00:00:00:00:00") and len(candidate.split(":")) >= 6

    def _is_mac_family(addr) -> bool:
        """Return True if this address entry represents a MAC/hardware address.
        psutil reports AF_PACKET (17) on Linux, AF_LINK (18) on macOS.
        It may expose these as integer values or as enum names depending on OS/version.
        On some Windows builds psutil can expose AF_LINK as -1.
        """
        family = addr.family
        family_int = family.value if hasattr(family, "value") else int(family)
        family_name = str(getattr(family, "name", str(family)))
        return family_int in (-1, 17, 18) or ("AF_PACKET" in family_name) or ("AF_LINK" in family_name)

    # 2) Prefer MAC from the chosen interface.
    mac = None
    if best_iface and best_iface in addrs_by_iface:
        for addr in addrs_by_iface[best_iface]:
            if _is_mac_family(addr) and _valid_mac(addr.address):
                mac = addr.address.strip().lower().replace("-", ":")
                break

    # 3) Fallback: first valid MAC on a non-virtual interface that is up.
    if not mac:
        for iface, addrs in addrs_by_iface.items():
            iface_name = str(iface)
            iface_virtual = _is_virtual_iface(iface_name)
            iface_is_up = bool(stats_by_iface.get(iface_name).isup) if stats_by_iface.get(iface_name) else True
            if iface_virtual or not iface_is_up:
                continue
            for addr in addrs:
                if _is_mac_family(addr) and _valid_mac(addr.address):
                    mac = addr.address.strip().lower().replace("-", ":")
                    break
            if mac:
                break

    # 4) Last-resort: derive MAC from uuid.getnode() (works on all platforms)
    if not mac:
        try:
            node = uuid.getnode()
            if node and node != 0 and node != 0xFFFFFFFFFFFF:
                mac = ":".join(f"{(node >> (5-i)*8) & 0xff:02x}" for i in range(6))
        except Exception:
            pass

    logging.info("Network detection: local_ip=%s mac=%s best_iface=%s primary_ip=%s",
                 best_ip, mac, best_iface, primary_ip)
    return best_ip, mac


def get_public_ip(force_refresh: bool = False) -> str | None:
    """Best-effort public/global IPv4 lookup with short cache to avoid frequent external calls."""
    global _public_ip_cache_value, _public_ip_cache_ts

    now = time.time()
    if (
        not force_refresh
        and _public_ip_cache_value
        and (now - _public_ip_cache_ts) < PUBLIC_IP_CACHE_TTL_SECONDS
    ):
        return _public_ip_cache_value

    providers = [
        ("https://api.ipify.org?format=json", "json"),
        ("https://ifconfig.me/ip", "text"),
        ("https://icanhazip.com", "text"),
        ("https://checkip.amazonaws.com", "text"),
        ("https://ipinfo.io/ip", "text"),
    ]

    for url, response_type in providers:
        try:
            resp = requests.get(url, timeout=5)
            if resp.status_code >= 400:
                continue

            value = None
            if response_type == "json":
                value = (resp.json() or {}).get("ip")
            else:
                value = (resp.text or "").strip()

            if isinstance(value, str) and value:
                _public_ip_cache_value = value
                _public_ip_cache_ts = now
                return value
        except Exception as exc:
            logging.debug("Public IP provider failed (%s): %s", url, exc)

    return _public_ip_cache_value


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

    # Check if we have placeholder token (not a real token)
    token = config.get("registration_token", "").strip()
    if token == "placeholder-token":
        logging.warning("Registration skipped: placeholder token detected - this indicates the registration.token file was not properly copied during installation")
        return False, "Placeholder token detected - installation may be incomplete"
    
    # Validate configuration before attempting registration
    if not token:
        logging.warning("Registration skipped: no registration_token in config. This is expected during fresh install before token injection.")
        # Clear stale endpoint/account info when no token available
        if config.get("endpoint_id") or config.get("account_id"):
            logging.info("Clearing stale endpoint_id and account_id since registration_token is empty")
            config["endpoint_id"] = ""
            config["account_id"] = ""
            try:
                save_config(config)
            except Exception as e:
                logging.warning("Failed to clear stale IDs: %s", e)
        return False, "No registration_token available - skipping registration"
    
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

    local_ip, mac = get_network_info()
    public_ip = get_public_ip()

    payload = {
        "token": config.get("registration_token"),
        "hostname": os.uname().nodename if hasattr(os, "uname") else os.environ.get("COMPUTERNAME") or "unknown",
        "os": "macos" if sys.platform == "darwin" else ("windows" if os.name == "nt" else "linux"),
        "os_version": _os_version(),
        "agent_version": AGENT_VERSION,
        "agent_id": config.get("agent_id"),
        "ip_address": local_ip,
        "public_ip": public_ip,
        "mac_address": mac,
        "system_info": {
            "local_ip": local_ip,
            "public_ip": public_ip,
            "mac": mac,
        },
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
    local_ip, mac = get_network_info()
    public_ip = get_public_ip()
    agent_id = config.get("agent_id") or None
    account_id = config.get("account_id") or None
    endpoint_id = config.get("endpoint_id") or None
    
    if not agent_id:
        logging.error("Heartbeat failed: missing agent_id")
        return False, "Missing agent_id"
    
    payload = {
        "agent_id": agent_id,
        "endpoint_id": endpoint_id,
        "account_id": account_id,
        "agent_version": AGENT_VERSION,
        "status": "online",
        "system_info": {
            "os": "macos" if sys.platform == "darwin" else ("windows" if os.name == "nt" else "linux"),
            "hostname": os.uname().nodename if hasattr(os, "uname") else os.environ.get("COMPUTERNAME") or "unknown",
            "agent_version": AGENT_VERSION,
            "ip": local_ip,
            "local_ip": local_ip,
            "public_ip": public_ip,
            "mac": mac,
        },
    }
    try:
        url = f"{config['api_base']}/heartbeat"
        logging.debug("Sending heartbeat to %s", url)
        logging.info("Endpoint network info: local_ip=%s public_ip=%s", local_ip, public_ip)
        logging.debug(
            "Heartbeat payload: agent_id=%s account_id=%s local_ip=%s public_ip=%s",
            agent_id,
            account_id,
            local_ip,
            public_ip,
        )
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
                    retry_payload = {
                        **payload,
                        "endpoint_id": config.get("endpoint_id") or payload.get("endpoint_id"),
                        "account_id": config.get("account_id") or payload.get("account_id"),
                    }
                    resp_retry = requests.post(url, json=retry_payload, timeout=15)
                    if resp_retry.status_code < 400:
                        return True, resp_retry.json()
                    else:
                        logging.error("Retry heartbeat HTTP %s: %s", resp_retry.status_code, resp_retry.text)
                except Exception as exc_retry:
                    logging.exception("Retry heartbeat failed: %s", exc_retry)

        return False, str(exc)


def check_pending_scan_commands(config):
    """Check if there are any pending scan commands from the console"""
    agent_id = config.get("agent_id")
    account_id = config.get("account_id")
    
    if not agent_id or not account_id:
        return None, "Missing agent_id or account_id"
    
    try:
        api_url = config.get("api_base", "https://kuaminisystems.com/api/agent")
        url = f"{api_url}/scan-commands?agent_id={agent_id}&account_id={account_id}"
        logging.debug("Checking for pending scan commands")
        
        resp = requests.get(url, timeout=10)
        if resp.status_code >= 400:
            logging.debug("Scan command check HTTP %s", resp.status_code)
            return None, f"HTTP {resp.status_code}"
        
        body = resp.json()
        if body.get("has_pending_command"):
            return body.get("command"), None
        return None, None
    except Exception as e:
        logging.debug("Error checking scan commands: %s", e)
        return None, str(e)


def report_scan_command_result(config, command_id: str, scan_id: str, scan_type: str, 
                               total_threats: int, severity_breakdown: dict, 
                               status: str = "completed", error_message: str = None) -> Tuple[bool, str]:
    """Report the result of a scan command execution"""
    agent_id = config.get("agent_id")
    account_id = config.get("account_id")
    endpoint_id = config.get("endpoint_id")
    
    if not all([agent_id, account_id, command_id]):
        return False, "Missing required config fields"
    
    try:
        payload = {
            "agent_id": agent_id,
            "account_id": account_id,
            "command_id": command_id,
            "scan_id": scan_id,
            "scan_type": scan_type,
            "total_threats": total_threats,
            "severity_breakdown": severity_breakdown,
            "status": status,
            "error_message": error_message,
        }
        
        api_url = config.get("api_base", "https://kuaminisystems.com/api/agent")
        url = f"{api_url}/scan-commands-result"
        logging.info(f"Reporting scan command result: command_id={command_id}, threats={total_threats}")
        
        resp = requests.post(url, json=payload, timeout=15)
        if resp.status_code >= 400:
            logging.error(f"Scan command result report failed HTTP {resp.status_code}")
            return False, f"HTTP {resp.status_code}"
        
        logging.info(f"✓ Scan command result reported successfully")
        return True, "Success"
    except Exception as e:
        logging.error(f"Error reporting scan command result: {e}")
        return False, str(e)


def initialize_threat_detection(config: dict, log_callback=None) -> dict:
    try:
        from threat_detection import ThreatDetectionEngine, ThreatReporter, ThreatActionExecutor

        engine = ThreatDetectionEngine(log_callback=log_callback)
        reporter = ThreatReporter(
            api_base_url=config.get("api_base", "https://kuaminisystems.com/api/agent"),
            agent_id=config.get("agent_id"),
            account_id=config.get("account_id"),
            log_callback=log_callback,
        )
        executor = ThreatActionExecutor(log_callback=log_callback)

        logging.info("Threat detection initialized")
        return {
            "enabled": True,
            "engine": engine,
            "reporter": reporter,
            "executor": executor,
        }
    except Exception as e:
        logging.error("Threat detection init failed: %s", e, exc_info=True)
        return {"enabled": False, "error": str(e)}


def tray_main():
    """Run as full tray application with icon and menu."""
    setup_logging()
    logging.info("Starting Kuamini Agent Tray")
    config = load_config()

    threat_system = initialize_threat_detection(config, log_callback=logging.info)

    status = {"text": "Idle", "color": (46, 204, 113)}
    update_state = {
        "current_version": AGENT_VERSION,
        "latest_version": None,
        "download_url": None,
        "installer_filename": None,
        "available": False,
        "last_notified_version": None,
    }
    threat_policy = {
        "enabled": True,
        "scan_interval": int(config.get("threat_scan_interval") or 3600),
        "scan_mode": str(config.get("threat_scan_mode") or "quick").lower(),
        "realtime_monitor": bool(config.get("threat_realtime_monitor") or True),  # Enable real-time by default
        "realtime_interval": int(config.get("threat_realtime_interval") or 300),
        "auto_action": True,
    }
    
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

    def notify(title: str, message: str):
        try:
            if hasattr(icon, "notify"):
                icon.notify(message, title)
        except Exception as e:
            logging.debug("Notification failed: %s", e)

    def _apply_update_info(agent_update: dict | None):
        if not isinstance(agent_update, dict):
            return

        available = bool(agent_update.get("available"))
        latest_version = agent_update.get("latest_version")
        download_url = agent_update.get("download_url")
        installer_filename = agent_update.get("installer_filename")

        update_state["available"] = available
        update_state["latest_version"] = latest_version if isinstance(latest_version, str) else None
        update_state["download_url"] = download_url if isinstance(download_url, str) else None
        update_state["installer_filename"] = installer_filename if isinstance(installer_filename, str) else None

        if available and update_state.get("latest_version"):
            logging.info(
                "Agent update available: current=%s latest=%s url=%s",
                update_state.get("current_version"),
                update_state.get("latest_version"),
                update_state.get("download_url"),
            )
            if update_state.get("last_notified_version") != update_state.get("latest_version"):
                update_state["last_notified_version"] = update_state.get("latest_version")
                notify(
                    "Agent update available",
                    f"Version {update_state.get('latest_version')} is available. Use 'Upgrade to latest' from tray menu.",
                )

    def _safe_filename_from_url(url: str, fallback: str) -> str:
        try:
            parsed = urlparse(url)
            name = Path(parsed.path).name
            if name:
                return name
        except Exception:
            pass
        return fallback

    def do_upgrade_agent(icon_, item):
        if not update_state.get("available"):
            notify("No update", "Agent is already on the latest available version.")
            return

        download_url = update_state.get("download_url")
        latest_version = update_state.get("latest_version")
        if not isinstance(download_url, str) or not download_url:
            notify("Upgrade unavailable", "No download URL is available for this update.")
            return

        def _run_upgrade():
            try:
                set_status("Downloading update", (52, 152, 219))

                fallback_name = update_state.get("installer_filename") or f"KuaminiSecurityClient-{latest_version}"
                filename = _safe_filename_from_url(download_url, fallback_name)
                temp_path = Path(tempfile.gettempdir()) / filename

                logging.info("Downloading agent update from %s", download_url)
                with requests.get(download_url, stream=True, timeout=60) as resp:
                    resp.raise_for_status()
                    with open(temp_path, "wb") as f:
                        for chunk in resp.iter_content(chunk_size=1024 * 128):
                            if chunk:
                                f.write(chunk)

                logging.info("Downloaded update installer to %s", temp_path)

                if os.name == "nt":
                    subprocess.Popen(["msiexec", "/i", str(temp_path), "/passive", "/norestart"])
                    notify("Upgrade started", f"Installing version {latest_version}.")
                elif sys.platform == "darwin":
                    subprocess.Popen(["open", str(temp_path)])
                    notify("Upgrade ready", "Installer opened. Complete the upgrade in the macOS installer.")
                else:
                    # Linux packaging differs across distros; fall back to browser download for manual install.
                    webbrowser.open(download_url)
                    notify("Upgrade download", "Downloaded latest installer. Follow your Linux install steps.")

                set_status("Upgrade started", (46, 204, 113))
            except Exception as exc:
                logging.error("Failed to run agent upgrade: %s", exc, exc_info=True)
                set_status("Upgrade failed", (231, 76, 60))
                notify("Upgrade failed", str(exc))

        threading.Thread(target=_run_upgrade, daemon=True).start()

    def _coerce_policy_bool(value, default: bool) -> bool:
        if isinstance(value, bool):
            return value
        if isinstance(value, str):
            return value.strip().lower() in ["true", "1", "yes", "on"]
        if isinstance(value, int):
            return value != 0
        return default

    def _coerce_policy_int(value, default: int) -> int:
        try:
            return int(value)
        except Exception:
            return default

    def apply_threat_policies(policies: list | None):
        if not policies:
            return
        updated = False
        for policy in policies:
            if not isinstance(policy, dict):
                continue
            if policy.get("is_active") is False:
                continue

            policy_type = (policy.get("type") or "").lower()
            cfg = policy.get("config") or policy.get("settings") or {}
            if not isinstance(cfg, dict):
                continue

            if policy_type in ["real_time_protection", "scheduled_scan", "threat_detection"]:
                if "threat_detection_enabled" in cfg or "enabled" in cfg:
                    threat_policy["enabled"] = _coerce_policy_bool(
                        cfg.get("threat_detection_enabled", cfg.get("enabled")),
                        threat_policy["enabled"],
                    )
                    updated = True

            if policy_type == "scheduled_scan":
                if "scan_interval" in cfg or "interval" in cfg:
                    threat_policy["scan_interval"] = _coerce_policy_int(
                        cfg.get("scan_interval", cfg.get("interval")),
                        threat_policy["scan_interval"],
                    )
                    updated = True
                if "scan_mode" in cfg or "mode" in cfg:
                    threat_policy["scan_mode"] = str(cfg.get("scan_mode", cfg.get("mode"))).lower()
                    updated = True

            if policy_type == "real_time_protection":
                if "enabled" in cfg or "realtime_enabled" in cfg:
                    threat_policy["realtime_monitor"] = _coerce_policy_bool(
                        cfg.get("realtime_enabled", cfg.get("enabled")),
                        threat_policy["realtime_monitor"],
                    )
                    updated = True
                if "interval" in cfg or "realtime_interval" in cfg:
                    threat_policy["realtime_interval"] = _coerce_policy_int(
                        cfg.get("realtime_interval", cfg.get("interval")),
                        threat_policy["realtime_interval"],
                    )
                    updated = True

            if policy_type == "threat_actions":
                if "auto_action" in cfg:
                    threat_policy["auto_action"] = _coerce_policy_bool(
                        cfg.get("auto_action"),
                        threat_policy["auto_action"],
                    )
                    updated = True

        if updated:
            logging.info(
                "Threat policy updated: enabled=%s scan_interval=%s scan_mode=%s realtime=%s realtime_interval=%s auto_action=%s",
                threat_policy["enabled"],
                threat_policy["scan_interval"],
                threat_policy["scan_mode"],
                threat_policy["realtime_monitor"],
                threat_policy["realtime_interval"],
                threat_policy["auto_action"],
            )

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
            ok, res = heartbeat(config)
            if ok and isinstance(res, dict):
                apply_threat_policies(res.get("policies"))
                _apply_update_info(res.get("agent_update"))
            set_status("Online" if ok else "Heartbeat failed", (46, 204, 113) if ok else (231, 76, 60))
            stop_event.wait(interval)

    def _execute_action_for_threat(action: str, threat: dict) -> Tuple[bool, str]:
        action = action.lower()
        if action == "quarantine" and threat.get("file_path"):
            return threat_system["executor"].quarantine_file(threat["file_path"])
        if action == "delete" and threat.get("file_path"):
            return threat_system["executor"].delete_file(threat["file_path"])
        if action == "kill" and threat.get("process_id"):
            return threat_system["executor"].kill_process(int(threat["process_id"]))
        if action == "allow" and threat.get("file_hash"):
            return threat_system["executor"].allow_threat(threat["file_hash"])
        return False, f"Unsupported or missing data for action: {action}"

    def _report_and_handle_actions(report):
        logging.info(f"Starting to report scan results: {report.total_threats} threats detected")
        ok, results = threat_system["reporter"].report_scan_results(
            report,
            endpoint_id=config.get("endpoint_id"),
        )
        if not results:
            logging.info(f"✓ Scan completed: 0 threats to process")
            return ok

        logging.info(f"✓ Reported {len([r for r in results if r.get('success')])} threats successfully")

        for idx, result in enumerate(results):
            if not result.get("success"):
                continue
            threat = report.threats[idx] if report.threats and idx < len(report.threats) else {}
            response = result.get("result") if isinstance(result.get("result"), dict) else {}
            action = response.get("recommended_action") or response.get("auto_action")
            threat_id = response.get("threat_id")

            if action and threat_policy.get("auto_action", True):
                handled, msg = _execute_action_for_threat(action, threat)
                if handled:
                    if threat_id:
                        status_map = {
                            "quarantine": "quarantined",
                            "kill": "killed",
                            "delete": "resolved",
                            "allow": "allowed",
                        }
                        threat_system["reporter"].update_threat_status(
                            threat_id,
                            status_map.get(action, "resolved"),
                            action=action,
                        )
                    notify("Threat resolved", f"{threat.get('threat_name', 'Threat')} - {action}")
                    logging.info("Threat action applied: %s (%s)", action, threat.get("threat_name"))
                else:
                    logging.warning("Threat action failed: %s", msg)
        return ok

    def threat_scan_loop():
        while not stop_event.is_set():
            try:
                if not threat_policy.get("enabled", True):
                    stop_event.wait(60)
                    continue

                # First, check for pending remote scan commands
                pending_command, cmd_error = check_pending_scan_commands(config)
                
                if pending_command:
                    logging.info(f"🔍 Executing remote scan command: {pending_command.get('scan_type')}")
                    set_status(f"Remote scan: {pending_command.get('scan_type')}", (241, 196, 15))
                    
                    # Execute the requested scan type
                    scan_mode = pending_command.get("scan_type", "quick").lower()
                    command_id = pending_command.get("id")
                else:
                    # No remote command, use local policy
                    scan_mode = str(threat_policy.get("scan_mode") or "quick").lower()
                    command_id = None

                # Execute the scan
                if scan_mode == "full":
                    report = threat_system["engine"].full_scan()
                elif scan_mode == "realtime":
                    report = threat_system["engine"].realtime_scan()
                else:
                    report = threat_system["engine"].quick_scan()

                # Report results
                if report.total_threats > 0:
                    notify("Threat detected", f"{report.total_threats} threats found")
                    logging.warning(f"⚠️  {report.total_threats} threats detected - {report.critical_count} critical, {report.high_count} high")
                _report_and_handle_actions(report)
                
                # If this was a remote command, report its completion
                if command_id and pending_command:
                    success, msg = report_scan_command_result(
                        config,
                        command_id=command_id,
                        scan_id=report.scan_id,
                        scan_type=report.scan_type,
                        total_threats=report.total_threats,
                        severity_breakdown={
                            "critical": report.critical_count,
                            "high": report.high_count,
                            "medium": report.medium_count,
                            "low": report.low_count,
                        },
                        status="completed",
                    )
                    if success:
                        logging.info(f"✓ Remote scan command completed and reported")
                    else:
                        logging.warning(f"⚠️  Failed to report remote scan completion: {msg}")
                
                # Determine wait interval
                if command_id:
                    # If this was a remote command, check more frequently for the next one
                    wait_interval = 10
                else:
                    # Normal scheduled scan interval
                    wait_interval = int(threat_policy.get("scan_interval") or 3600)
                
            except Exception as e:
                logging.error("Threat scan loop error: %s", e, exc_info=True)
                wait_interval = 300  # Wait 5 minutes on error before retrying

            stop_event.wait(wait_interval)

    def realtime_monitor_loop():
        while not stop_event.is_set():
            try:
                if not threat_policy.get("enabled", True) or not threat_policy.get("realtime_monitor", False):
                    stop_event.wait(60)
                    continue

                logging.debug("Running real-time threat monitor")
                report = threat_system["engine"].realtime_scan()
                
                if report and report.total_threats > 0:
                    logging.warning(f"🔴 Real-time alert: {report.total_threats} threats detected")
                    
                    # Report critical and high severity threats immediately
                    critical_threats = [t for t in (report.threats or []) if t.get("severity") in ["critical", "high"]]
                    if critical_threats:
                        threat_names = ", ".join([t.get("threat_name", "Unknown") for t in critical_threats[:3]])
                        notify("⚠️ Critical Threat Detected", f"{len(critical_threats)} critical/high threats: {threat_names}")
                        logging.error(f"🚨 CRITICAL THREATS DETECTED: {threat_names}")
                    
                    # Report all threats
                    _report_and_handle_actions(report)
            except Exception as e:
                logging.error("Realtime threat monitor error: %s", e, exc_info=True)

            stop_event.wait(int(threat_policy.get("realtime_interval") or 300))

    def do_quick_threat_scan(icon_, item):
        if not threat_system.get("enabled"):
            logging.info("Threat scan requested but feature is disabled")
            return
        if not threat_policy.get("enabled", True):
            logging.info("Threat scan requested but disabled by policy")
            return

        def _run_scan():
            try:
                set_status("Threat scan running", (241, 196, 15))
                report = threat_system["engine"].quick_scan()
                if report.total_threats > 0:
                    set_status(f"Threats: {report.total_threats}", (231, 76, 60))
                    notify("Threat detected", f"{report.total_threats} threats found")
                else:
                    set_status("Scan clean", (46, 204, 113))
                _report_and_handle_actions(report)
            except Exception as e:
                logging.error("Quick threat scan failed: %s", e, exc_info=True)
                set_status("Scan failed", (231, 76, 60))

        threading.Thread(target=_run_scan, daemon=True).start()

    def build_menu():
        """Build menu dynamically so status updates in real time."""
        items = [
            pystray.MenuItem(lambda item: f"● Agent: {config.get('agent_id', 'unknown')[:8]}...", None, enabled=False),
            pystray.MenuItem(lambda item: f"◉ Status: {status.get('text', 'Unknown')}", None, enabled=False),
            pystray.MenuItem(lambda item: f"⟳ Version: {update_state.get('current_version')}", None, enabled=False),
            pystray.MenuItem(
                lambda item: (
                    f"⬆ Update: {update_state.get('latest_version')} available"
                    if update_state.get("available") and update_state.get("latest_version")
                    else "⬆ Update: Up to date"
                ),
                None,
                enabled=False,
            ),
            pystray.MenuItem(lambda item: f"  Account: {config.get('account_id', 'Not set')[:8]}..." if config.get('account_id') else "  Account: Not configured", None, enabled=False),
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Register now", do_register),
            pystray.MenuItem("Send heartbeat", do_heartbeat),
            pystray.MenuItem("Upgrade to latest", do_upgrade_agent),
            pystray.MenuItem("Open console", open_console),
        ]

        if threat_system.get("enabled"):
            items.extend([
                pystray.Menu.SEPARATOR,
                pystray.MenuItem("Quick threat scan", do_quick_threat_scan),
            ])

        items.extend([
            pystray.Menu.SEPARATOR,
            pystray.MenuItem("Quit", quit_app),
        ])

        return pystray.Menu(*items)
    
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
            
            # Trigger initial scan after successful registration
            if threat_system.get("enabled"):
                logging.info("🔍 Triggering initial scan after registration...")
                def _run_initial_scan():
                    try:
                        set_status("Initial security scan", (241, 196, 15))
                        report = threat_system["engine"].quick_scan()
                        logging.info(f"✓ Initial scan completed: {report.total_threats} threats found")
                        if report.total_threats > 0:
                            logging.warning(f"⚠️  Initial scan detected {report.total_threats} threats")
                            notify("Threats detected", f"{report.total_threats} threats found in initial scan")
                        else:
                            logging.info("✓ Initial scan clean - no threats detected")
                        _report_and_handle_actions(report)
                        set_status("Online", (46, 204, 113))
                    except Exception as e:
                        logging.error("Initial scan failed: %s", e, exc_info=True)
                        set_status("Initial scan failed", (231, 76, 60))
                
                # Run initial scan in background thread
                threading.Thread(target=_run_initial_scan, daemon=True).start()
        else:
            logging.warning("✗ Auto-registration failed: %s", res)
            set_status("Registration failed, retrying on heartbeat")
    
    threading.Thread(target=heartbeat_loop, daemon=True).start()

    if threat_system.get("enabled"):
        threading.Thread(target=threat_scan_loop, daemon=True).start()
        threading.Thread(target=realtime_monitor_loop, daemon=True).start()

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
    
    def log_to_emergency_file(msg: str):
        """Write to emergency log file even if regular logging fails."""
        try:
            import datetime
            if os.name == "nt":
                log_dir = Path(os.environ.get("LOCALAPPDATA", Path.home())) / "KuaminiSecurityClient"
            else:
                log_dir = Path.home() / ".local" / "share" / "KuaminiSecurityClient"
            
            log_dir.mkdir(parents=True, exist_ok=True)
            error_log = log_dir / "startup_errors.log"
            
            with open(error_log, "a", encoding="utf-8") as f:
                timestamp = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                f.write(f"[{timestamp}] {msg}\n")
                f.flush()
        except Exception as e:
            safe_print(f"[ERROR] Could not write to emergency log: {e}")

    # Ensure all output is captured, even on early crashes
    safe_print("[STARTUP] Agent starting...")
    log_to_emergency_file("Agent starting...")
    
    # Check for singleton enforcement early
    try:
        if is_another_instance_running():
            msg = "Another instance is already running. Exiting."
            safe_print(f"[STARTUP] {msg}")
            log_to_emergency_file(msg)
            sys.exit(0)
    except Exception as e:
        msg = f"Failed to check for running instances: {e}"
        safe_print(f"[WARNING] {msg}")
        log_to_emergency_file(msg)
    
    try:
        safe_print("[STARTUP] About to call tray_main()")
        log_to_emergency_file("Calling tray_main()")
        tray_main()
    except KeyboardInterrupt:
        msg = "Received keyboard interrupt"
        safe_print(f"[SHUTDOWN] {msg}")
        log_to_emergency_file(msg)
    except Exception as e:
        # Ensure unexpected exceptions are logged, even before setup_logging
        msg = f"Exception before setup_logging: {type(e).__name__}: {e}"
        safe_print(f"[ERROR] {msg}")
        log_to_emergency_file(msg)
        
        import traceback
        stream = sys.stderr or sys.stdout
        if stream:
            try:
                traceback.print_exc(file=stream)
                stream.flush()
            except Exception:
                pass
        
        # Write full traceback to emergency log
        try:
            tb_str = traceback.format_exc()
            log_to_emergency_file(f"Full traceback:\n{tb_str}")
        except Exception:
            pass
        
        # Try to also setup logging and log the error
        try:
            setup_logging()
            logging.exception("Fatal error: %s", e)
        except Exception as log_error:
            msg = f"Failed to setup logging: {log_error}"
            print(f"[ERROR] {msg}", file=sys.stderr)
            log_to_emergency_file(msg)
            sys.stderr.flush()
