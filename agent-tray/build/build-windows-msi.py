#!/usr/bin/env python3
"""
Build Windows MSI installer for Kuamini Security Client.
This script runs PyInstaller to freeze the Python code, then invokes
the WiX toolset to create the MSI package.
"""

import os
import sys
import subprocess
import shutil
from pathlib import Path

def run_command(cmd, description):
    """Run a shell command and handle errors."""
    print(f"\n{'='*60}")
    print(f"Running: {description}")
    print(f"{'='*60}")
    print(f"Command: {' '.join(cmd)}")
    print()
    
    result = subprocess.run(cmd, shell=False)
    if result.returncode != 0:
        print(f"\n[ERROR] {description} failed with exit code {result.returncode}")
        sys.exit(1)
    
    print(f"[SUCCESS] {description} completed successfully")
    return result

def main():
    """Main build process."""
    # Determine paths
    script_dir = Path(__file__).parent
    agent_dir = script_dir.parent
    project_root = agent_dir.parent
    
    # Change to agent-tray directory
    os.chdir(agent_dir)
    
    print(f"""
{'='*60}
Building Kuamini Security Client for Windows
Python Version: {sys.version.split()[0]}
Build Directory: {str(agent_dir)[-42:]}
{'='*60}
""")
    
    # Step 1: Clean old build artifacts
    print("Cleaning old build artifacts...")
    dist_dir = agent_dir / "dist" / "KuaminiSecurityClient"
    if dist_dir.exists():
        shutil.rmtree(dist_dir, ignore_errors=True)
        print(f"  Removed: {dist_dir}")
    
    # Step 2: Run PyInstaller
    spec_file = script_dir / "KuaminiSecurityClient.spec"
    if not spec_file.exists():
        # If no spec file, run PyInstaller with basic args
        print("\n[WARNING] No .spec file found, generating from main.py")
        pyinstaller_cmd = [
            sys.executable, "-m", "PyInstaller",
            "--name", "KuaminiSecurityClient",
            "--onedir",
            "--windowed",
            "--distpath", str(agent_dir / "dist"),
            "--workpath", str(agent_dir / "build" / "pyinstaller"),
            "--specpath", str(script_dir),
            "--add-data", f"{str(agent_dir / 'config.json')};.",
            str(agent_dir / "main.py")
        ]
    else:
        # Use existing spec file
        pyinstaller_cmd = [
            sys.executable, "-m", "PyInstaller",
            "--distpath", str(agent_dir / "dist"),
            "--workpath", str(agent_dir / "build" / "pyinstaller"),
            str(spec_file)
        ]
    
    run_command(pyinstaller_cmd, "PyInstaller (freeze Python code)")
    
    exe_path = agent_dir / "dist" / "KuaminiSecurityClient" / "KuaminiSecurityClient.exe"
    if not exe_path.exists():
        print(f"\n[ERROR] Expected EXE not found at {exe_path}")
        sys.exit(1)
    
    print(f"[SUCCESS] EXE created: {exe_path}")
    print(f"   Size: {exe_path.stat().st_size / 1024 / 1024:.2f} MB")
    
    # Step 3: Run WiX MSI build via PowerShell
    ps_script = script_dir / "build-windows-msi.ps1"
    if not ps_script.exists():
        print(f"\n[ERROR] PowerShell build script not found at {ps_script}")
        sys.exit(1)
    
    # Get version from environment or default
    version = os.environ.get("MSI_VERSION", "1.0.5")
    
    powershell_cmd = [
        "powershell",
        "-NoProfile",
        "-ExecutionPolicy", "Bypass",
        "-File", str(ps_script),
        "-Version", version
    ]
    
    run_command(powershell_cmd, "WiX MSI Build")
    
    # Step 4: Verify MSI was created
    msi_path = agent_dir / "dist" / f"KuaminiSecurityClient-{version}.msi"
    if not msi_path.exists():
        print(f"\n[ERROR] MSI not found at {msi_path}")
        sys.exit(1)
    
    print(f"\n[SUCCESS] MSI created: {msi_path}")
    print(f"   Size: {msi_path.stat().st_size / 1024 / 1024:.2f} MB")
    
    # Step 5: Create Windows installer ZIP for distribution
    print("\nCreating installer bundle...")
    
    # Create ZIP with MSI only (registration token will be added by download API)
    import zipfile
    zip_path = project_root / "public" / "tray" / "windows.zip"
    zip_path.parent.mkdir(parents=True, exist_ok=True)
    
    with zipfile.ZipFile(zip_path, 'w', zipfile.ZIP_DEFLATED) as zf:
        zf.write(msi_path, arcname=f"KuaminiSecurityClient-{version}.msi")
    
    print(f"[SUCCESS] ZIP bundle created: {zip_path}")
    print(f"   Size: {zip_path.stat().st_size / 1024 / 1024:.2f} MB")
    
    print(f"""
{'='*60}
BUILD COMPLETED SUCCESSFULLY!

MSI: {str(msi_path.name)}
ZIP: {str(zip_path.name)}
{'='*60}
    """)

if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("\n\n[ERROR] Build interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\n[ERROR] Build failed with error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
