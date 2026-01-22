#!/usr/bin/env python3
"""
Build Windows MSI installer using WiX Toolset.
Invokes the PowerShell build script with proper environment setup.
"""

import subprocess
import sys
import os
from pathlib import Path

def main():
    # Get the script directory
    script_dir = Path(__file__).parent
    ps_script = script_dir / "build-windows-msi.ps1"
    
    if not ps_script.exists():
        print(f"Error: PowerShell build script not found: {ps_script}")
        sys.exit(1)
    
    # Get source directory (repo root)
    source_dir = script_dir.parent.parent
    
    # Check prerequisites
    exe_path = source_dir / "agent-tray" / "dist" / "KuaminiSecurityClient" / "KuaminiSecurityClient.exe"
    config_path = source_dir / "agent-tray" / "config.json"
    
    if not exe_path.exists():
        print(f"Error: Executable not found: {exe_path}")
        print("Please run PyInstaller first: pyinstaller main.py --onedir --windowed")
        sys.exit(1)

    if not config_path.exists():
        print(f"Config file not found, generating default: {config_path}")
        gen_script = source_dir / "agent-tray" / "generate_config.py"
        if not gen_script.exists():
            print("Error: generate_config.py is missing; cannot create config")
            sys.exit(1)
        result = subprocess.run([sys.executable, str(gen_script)], cwd=source_dir)
        if result.returncode != 0 or not config_path.exists():
            print("Error: Failed to generate config.json")
            sys.exit(1)
    
    print("Building Kuamini Security Client Windows MSI...")
    print(f"  Executable: {exe_path}")
    print(f"  Config: {config_path}")
    
    # Run PowerShell script
    try:
        result = subprocess.run(
            [
                "powershell",
                "-NoProfile",
                "-ExecutionPolicy", "Bypass",
                "-File", str(ps_script),
                "-SourceDir", str(source_dir),
                "-OutputDir", str(source_dir / "agent-tray" / "dist")
            ],
            check=False
        )
        
        if result.returncode != 0:
            print("MSI build failed", file=sys.stderr)
            sys.exit(result.returncode)
        
        print("\nMSI build completed successfully!")
        print(f"Output: {source_dir / 'public' / 'tray' / 'KuaminiSecurityClient-1.0.0.msi'}")
        
    except FileNotFoundError:
        print("Error: PowerShell not found. This script requires PowerShell 5.0+", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

