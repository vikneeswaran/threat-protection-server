#!/usr/bin/env python3
"""
Kuamini Security Client - Diagnostic Tool
Helps identify and fix common installation and runtime issues
"""

import json
import os
import sys
from pathlib import Path
import subprocess

def check_file_exists(path_str: str, description: str) -> bool:
    """Check if a file exists and report status."""
    path = Path(path_str).expanduser()
    if path.exists():
        print(f"✓ {description}: {path}")
        return True
    else:
        print(f"✗ {description} NOT FOUND: {path}")
        return False

def check_config():
    """Check configuration file."""
    print("\n=== Configuration ===")
    
    if os.name == 'nt':
        config_path = Path.home() / ".kuamini" / "config.json"
    else:
        config_path = Path.home() / ".kuamini" / "config.json"
    
    if config_path.exists():
        print(f"✓ Config file found: {config_path}")
        try:
            with open(config_path, 'r', encoding='utf-8-sig') as f:
                config = json.load(f)
            
            # Check required fields
            required = ['api_base', 'agent_id', 'console_url']
            for field in required:
                if config.get(field):
                    if field == 'registration_token':
                        print(f"  ✓ {field}: ***masked***")
                    else:
                        print(f"  ✓ {field}: {config[field]}")
                else:
                    print(f"  ✗ {field}: MISSING")
            
            # Check token
            token = config.get('registration_token')
            if token:
                print(f"  ✓ registration_token: present ({len(token)} chars)")
            else:
                print(f"  ✗ registration_token: MISSING")
            
            # Check auto_register
            auto_reg = config.get('auto_register', False)
            print(f"  {'✓' if auto_reg else '✗'} auto_register: {auto_reg}")
            
            return config
        except json.JSONDecodeError as e:
            print(f"✗ Config is invalid JSON: {e}")
            return None
        except Exception as e:
            print(f"✗ Error reading config: {e}")
            return None
    else:
        print(f"✗ Config file not found: {config_path}")
        print("  Create ~/.kuamini/config.json with registration_token")
        return None

def check_logs():
    """Check log files."""
    print("\n=== Logs ===")
    
    if sys.platform == 'darwin':
        log_path = Path.home() / "Library" / "Logs" / "KuaminiSecurityClient" / "agent.log"
    elif os.name == 'nt':
        log_path = Path(os.environ.get('LOCALAPPDATA', Path.home())) / "KuaminiSecurityClient" / "agent.log"
    else:
        log_path = Path.home() / ".local" / "share" / "KuaminiSecurityClient" / "agent.log"
    
    if log_path.exists():
        print(f"✓ Log file found: {log_path}")
        print("\nLast 20 lines:")
        try:
            with open(log_path, 'r', encoding='utf-8-sig') as f:
                lines = f.readlines()
                for line in lines[-20:]:
                    print(f"  {line.rstrip()}")
        except Exception as e:
            print(f"✗ Error reading logs: {e}")
    else:
        print(f"✗ Log file not found: {log_path}")
        print("  Agent may not have run yet")

def check_process():
    """Check if agent process is running."""
    print("\n=== Process Status ===")
    
    try:
        if sys.platform == 'win32' or os.name == 'nt':
            result = subprocess.run(
                ['tasklist', '/FI', 'IMAGENAME eq KuaminiSecurityClient.exe'],
                capture_output=True, text=True
            )
            if 'KuaminiSecurityClient.exe' in result.stdout:
                print("✓ KuaminiSecurityClient process is running")
                return True
            else:
                print("✗ KuaminiSecurityClient process is NOT running")
                return False
        else:
            result = subprocess.run(
                ['pgrep', '-f', 'KuaminiSecurityClient'],
                capture_output=True, text=True
            )
            if result.returncode == 0:
                print("✓ KuaminiSecurityClient process is running")
                return True
            else:
                print("✗ KuaminiSecurityClient process is NOT running")
                return False
    except Exception as e:
        print(f"? Could not check process: {e}")
        return None

def check_network():
    """Check network connectivity."""
    print("\n=== Network ===")
    
    try:
        import socket
        host = 'kuaminisystems.com'
        port = 443
        
        sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        sock.settimeout(5)
        result = sock.connect_ex((host, port))
        sock.close()
        
        if result == 0:
            print(f"✓ Can connect to {host}:{port}")
            return True
        else:
            print(f"✗ Cannot connect to {host}:{port}")
            return False
    except Exception as e:
        print(f"? Network check failed: {e}")
        return None

def check_python_deps():
    """Check Python dependencies."""
    print("\n=== Python Dependencies ===")
    
    required = {
        'pystray': 'System tray icon support',
        'requests': 'HTTP requests',
        'psutil': 'System monitoring',
        'PIL': 'Image processing',
    }
    
    for pkg, desc in required.items():
        try:
            __import__(pkg)
            print(f"✓ {pkg}: {desc}")
        except ImportError:
            print(f"✗ {pkg}: {desc} - NOT INSTALLED")

def main():
    print("=" * 60)
    print("Kuamini Security Client - Diagnostic Tool")
    print("=" * 60)
    
    config = check_config()
    check_logs()
    is_running = check_process()
    has_network = check_network()
    check_python_deps()
    
    print("\n=== Summary ===")
    
    if config and config.get('registration_token'):
        print("✓ Configuration looks good")
    else:
        print("✗ Configuration missing registration_token")
    
    if has_network:
        print("✓ Network connectivity OK")
    else:
        print("✗ Network connectivity issues")
    
    if is_running:
        print("✓ Agent is running")
    else:
        print("✗ Agent is not running - start it manually or restart system")
    
    print("\n" + "=" * 60)

if __name__ == '__main__':
    main()
