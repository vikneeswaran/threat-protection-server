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
    
    # Try new build-windows.ps1 first (simpler, ZIP-based), fallback to MSI builder
    ps_script = script_dir / "build-windows.ps1"
    if not ps_script.exists():
        ps_script = script_dir / "build-windows-msi.ps1"
    
    if not ps_script.exists():
        print(f"Error: PowerShell build script not found: {ps_script}")
        sys.exit(1)
    
    # Get source directory (repo root)
    source_dir = script_dir.parent.parent
    
    # Generate config if needed
    config_path = source_dir / "agent-tray" / "config.json"
    if not config_path.exists():
        print(f"Config file not found, generating default: {config_path}")
        gen_script = source_dir / "agent-tray" / "generate_config.py"
        if gen_script.exists():
            result = subprocess.run([sys.executable, str(gen_script)], cwd=source_dir / "agent-tray")
            if result.returncode == 0:
                print(f"Wrote {config_path}")
    
    print(f"Building Kuamini Security Client for Windows using {ps_script.name}...")
    
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
            print("Build failed", file=sys.stderr)
            sys.exit(result.returncode)
        
        print("\nBuild completed successfully!")
        
    except FileNotFoundError:
        print("Error: PowerShell not found. This script requires PowerShell 5.0+", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()

